import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import ky, { type KyInstance } from 'ky';

interface RefreshTokensResponse {
  accessToken: string;
  refreshToken: string;
}

let kyInstance: KyInstance | null = null;
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

export const createAuthClient = (storage: Storage): KyInstance => {
  if (kyInstance) {
    return kyInstance;
  }

  kyInstance = ky.create({
    prefixUrl: ENV.API_URL,
    timeout: 10_000,
    headers: {
      'Content-Type': 'application/json',
    },
    hooks: {
      beforeRequest: [
        async (request) => {
          const accessToken = await storage.get<string>('accessToken');
          if (accessToken) {
            request.headers.set('Authorization', `Bearer ${accessToken}`);
          }
        },
      ],
      afterResponse: [
        async (request, _options, response) => {
          if (response.status !== 401) {
            return response;
          }

          // 이미 토큰 갱신 중이면 갱신 완료를 기다린 후 재시도
          if (isRefreshing) {
            await refreshPromise;
            const newAccessToken = await storage.get<string>('accessToken');
            if (newAccessToken) {
              request.headers.set('Authorization', `Bearer ${newAccessToken}`);
              return ky(request);
            }
            return response;
          }

          isRefreshing = true;
          refreshPromise = (async () => {
            try {
              const refreshToken = await storage.get<string>('refreshToken');
              if (!refreshToken) {
                throw new Error('No refresh token available');
              }

              const refreshResponse = await ky.post('v1/auth/refresh', {
                prefixUrl: ENV.API_URL,
                headers: {
                  Authorization: `Bearer ${refreshToken}`,
                  'Content-Type': 'application/json',
                },
              });

              const json = (await refreshResponse.json()) as {
                success: boolean;
                data: RefreshTokensResponse;
                timestamp: number;
              };
              const tokens = json.data;

              await storage.set('accessToken', tokens.accessToken);
              await storage.set('refreshToken', tokens.refreshToken);
            } catch {
              await storage.remove('accessToken');
              await storage.remove('refreshToken');
              throw new Error('Token refresh failed');
            }
          })();

          try {
            await refreshPromise;
            const newAccessToken = await storage.get<string>('accessToken');
            if (newAccessToken) {
              request.headers.set('Authorization', `Bearer ${newAccessToken}`);
              return ky(request);
            }
          } catch {
            // 토큰 갱신 실패 - 원래 응답 반환
          } finally {
            isRefreshing = false;
            refreshPromise = null;
          }

          return response;
        },
      ],
    },
  });

  return kyInstance;
};

export const resetAuthClient = () => {
  kyInstance = null;
  isRefreshing = false;
  refreshPromise = null;
};

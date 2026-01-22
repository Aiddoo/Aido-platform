import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import ky, { type KyInstance } from 'ky';

interface RefreshTokensResponse {
  accessToken: string;
  refreshToken: string;
}

let kyInstance: KyInstance | null = null;

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
          if (response.status === 401) {
            const refreshToken = await storage.get<string>('refreshToken');
            if (!refreshToken) {
              return response;
            }

            try {
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

              // 원래 요청 재시도
              request.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
              return ky(request);
            } catch {
              // 리프레시 실패 시 토큰 삭제
              await storage.remove('accessToken');
              await storage.remove('refreshToken');
              return response;
            }
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
};

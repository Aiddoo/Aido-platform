import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import { STORAGE_KEYS } from '@src/shared/constants/storage-keys.constant';
import { i18n } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import ky, { type AfterResponseHook, type KyInstance } from 'ky';
import { handleApiErrors } from './error-handler';
import type { TokenRefresher } from './token-refresher';

/** 갱신 후 재시도된 요청 표시 — 재시도가 다시 401이어도 갱신을 반복하지 않는다 */
const RETRY_MARKER_HEADER = 'x-retried-after-refresh';

let kyInstance: KyInstance | null = null;

interface TokenRefreshHookDeps {
  storage: Storage;
  refresh: TokenRefresher;
  retry: (request: Request) => Promise<Response>;
}

/**
 * 401 응답 처리 훅.
 *
 * - 갱신 성공 시 원 요청을 인스턴스 훅 경유로 재시도한다. ky는 요청을 clone해서
 *   전송하므로 훅에 전달된 request는 body가 소비되지 않은 원본이다 (POST 재시도 안전).
 * - 이미 다른 flight가 토큰을 로테이션한 뒤 도착한 401(stale token)은 갱신 없이
 *   바로 재시도한다 — 불필요한 갱신은 서버의 토큰 패밀리를 소모시킨다.
 * - 갱신 실패 시 원 401 응답을 그대로 반환해 ky-client가 ApiError로 일관 번역하게 한다.
 */
export const createTokenRefreshHook = (deps: TokenRefreshHookDeps): AfterResponseHook => {
  const { storage, refresh, retry } = deps;

  const retryWithMarker = (request: Request): Promise<Response> => {
    request.headers.set(RETRY_MARKER_HEADER, '1');
    return retry(request);
  };

  return async (request, _options, response) => {
    if (response.status !== 401) {
      return response;
    }

    if (request.headers.has(RETRY_MARKER_HEADER)) {
      return response;
    }

    const storedAccessToken = await storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN);
    const sentAuthorization = request.headers.get('Authorization');
    if (storedAccessToken && sentAuthorization !== `Bearer ${storedAccessToken}`) {
      return retryWithMarker(request);
    }

    const refreshed = await refresh();
    if (refreshed) {
      return retryWithMarker(request);
    }

    return response;
  };
};

/**
 * 인증 ky 클라이언트를 생성한다.
 *
 * refresh는 앱 전체에서 단일 인스턴스를 주입받는다(bootstrap의 DI에서 생성) —
 * 인스턴스가 갈라지면 single-flight mutex가 분리되어 동시 회전(토큰 패밀리 소모)이
 * 발생할 수 있다.
 */
export const createAuthClient = (storage: Storage, refresh: TokenRefresher): KyInstance => {
  if (kyInstance) {
    return kyInstance;
  }

  kyInstance = ky.create({
    prefixUrl: ENV.API_URL,
    timeout: 10_000,
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': getDeviceTimezone(),
    },
    hooks: {
      beforeRequest: [
        async (request) => {
          // 언어는 런타임에 바뀔 수 있으므로 정적 headers가 아닌 훅에서 주입한다
          if (i18n.language) {
            request.headers.set('Accept-Language', i18n.language);
          }

          const accessToken = await storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN);
          if (accessToken) {
            request.headers.set('Authorization', `Bearer ${accessToken}`);
          }
        },
      ],
      afterResponse: [
        handleApiErrors,
        createTokenRefreshHook({
          storage,
          refresh,
          retry: (request) => {
            if (!kyInstance) {
              throw new Error('Auth client is not initialized');
            }
            return kyInstance(request);
          },
        }),
      ],
    },
  });

  return kyInstance;
};

export const resetAuthClient = () => {
  kyInstance = null;
};

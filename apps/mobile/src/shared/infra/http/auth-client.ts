import type { TokenStore } from '@src/core/ports/token-store';
import { ENV } from '@src/shared/config/env';
import { i18n } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import ky, { type KyInstance } from 'ky';
import { handleApiErrors } from './error-handler';
import { createTokenRefreshHook, type EndSession } from './token-refresh-hook';
import type { TokenRefresher } from './token-refresher';

interface AuthClientDeps {
  tokenStore: TokenStore;
  /** 앱 전체 단일 인스턴스. 갈라지면 single-flight mutex가 분리돼 토큰 패밀리를 소모한다. */
  refresh: TokenRefresher;
  endSession: EndSession;
}

/**
 * 인증 ky 클라이언트를 생성한다.
 *
 * 이 클라이언트는 토큰을 들고 있지 않다 — 매 요청 `TokenStore`에서 읽는다.
 * 따라서 로그아웃/세션 만료 시 리셋하거나 재생성할 상태가 없다.
 */
export const createAuthClient = ({
  tokenStore,
  refresh,
  endSession,
}: AuthClientDeps): KyInstance => {
  // 재시도는 인스턴스 자신의 훅을 다시 태워야 하므로 자기 참조가 필요하다.
  const clientRef: { current: KyInstance | null } = { current: null };

  clientRef.current = ky.create({
    prefixUrl: ENV.API_URL,
    timeout: 10_000,
    // 재시도 정책은 React Query가 소유한다(`shouldRetryQuery`). ky가 401 훅 throw나 5xx를
    // 자체 재시도하면 갱신 훅과 겹쳐 토큰 패밀리를 소모하고 재시도 횟수가 이중 계산된다.
    retry: 0,
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

          const accessToken = await tokenStore.readAccessToken();
          if (accessToken) {
            request.headers.set('Authorization', `Bearer ${accessToken}`);
          }
        },
      ],
      afterResponse: [
        handleApiErrors,
        createTokenRefreshHook({
          tokenStore,
          refresh,
          endSession,
          retry: (request) => {
            const client = clientRef.current;
            if (!client) {
              throw new Error('Auth client is not initialized');
            }
            return client(request);
          },
        }),
      ],
    },
  });

  return clientRef.current;
};

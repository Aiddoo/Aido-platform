import type { TokenStore } from '@src/core/ports/token-store';
import { ENV } from '@src/shared/config/env';
import { i18n } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/utils/timezone';
import ky, { type KyInstance } from 'ky';
import { recordApiFailureBreadcrumb } from './error-handler';
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
  return ky.create({
    // v2: prefixUrl → prefix (append 시맨틱 동일 — input 앞에 붙이고 경계 슬래시 정규화)
    prefix: ENV.API_URL,
    timeout: 10_000,
    // 자동 재시도 정책은 React Query가 소유한다(`shouldRetryQuery`) — ky의 자체 재시도는
    // `shouldRetry: false`로 전부 차단한다(5xx/네트워크를 ky도 재시도하면 이중 계산).
    // limit: 1은 401 갱신 훅의 강제 재시도(`ky.retry()`) 1회를 허용하기 위한 것으로,
    // 강제 재시도는 shouldRetry 검사를 건너뛰고 limit만 따른다.
    retry: { limit: 1, shouldRetry: () => false },
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': getDeviceTimezone(),
    },
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          // 언어는 런타임에 바뀔 수 있으므로 정적 headers가 아닌 훅에서 주입한다.
          // ky v2에서 beforeRequest는 최초 1회만 실행된다(재시도 시 재실행 안 함) —
          // 401 갱신 후 새 토큰 주입은 token-refresh-hook이 재시도 요청에 직접 넣는다.
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
        recordApiFailureBreadcrumb,
        createTokenRefreshHook({ tokenStore, refresh, endSession }),
      ],
    },
  });
};

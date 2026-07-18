import type { SessionExpiredDetails } from '@src/core/ports/telemetry-event';
import type { TokenStore } from '@src/core/ports/token-store';
import { errorReporter } from '@src/shared/infra/error-reporter/global-error-reporter';
import ky, { type AfterResponseHook } from 'ky';
import { pathnameOf } from './error-handler';
import type { TokenRefresher } from './token-refresher';

/** 갱신 후 재시도된 요청 표시 — 재시도가 다시 401이어도 갱신을 반복하지 않는다 */
export const RETRY_MARKER_HEADER = 'x-retried-after-refresh';

/** 세션 종료 확정을 위임하는 포트. 구현은 `SessionManager.end`. */
export type EndSession = (details: SessionExpiredDetails) => Promise<void>;

export interface TokenRefreshHookDeps {
  tokenStore: TokenStore;
  refresh: TokenRefresher;
  endSession: EndSession;
}

/**
 * 401 응답 처리 훅.
 *
 * - 갱신/회전 성공 시 `ky.retry({ request })`로 재시도를 지시한다. **ky v2에서
 *   beforeRequest는 최초 1회만 실행되고 재시도 시 다시 돌지 않으므로**, 재시도 요청에
 *   새 Authorization을 직접 주입한다(원 요청의 body·method·나머지 헤더는 보존).
 *   **주의: 재시도 응답 객체를 훅에서 직접 반환하면 안 된다** — RN(Expo winter)의
 *   `expo/fetch` 응답은 `globalThis.Response`의 인스턴스가 아니라서 ky가 조용히 버리고
 *   원본 401을 살린다(1.4.x 콜드스타트 전위젯 재시도 카드의 근본 원인). `ky.retry()`
 *   마커는 그 함정이 없다.
 * - 이미 다른 flight가 토큰을 회전한 뒤 도착한 401(stale token)은 갱신 없이
 *   저장된 최신 토큰으로 바로 재시도한다 — 불필요한 갱신은 서버의 토큰 패밀리를 소모시킨다.
 * - 세션이 무효로 확정되면(`invalid`) 원 401 응답을 반환하고 세션을 종료한다.
 * - 갱신의 일시 실패(네트워크·5xx·타임아웃·잠긴 키체인)는 갱신기가 재시도 가능한
 *   인프라 에러로 throw하며, 훅은 개입하지 않고 그대로 전파한다 — React Query가
 *   5xx/네트워크와 동일하게 자동 재시도한다(재시도 화면 대신 로딩 유지, 세션 보존).
 * - 갱신 직후 재발급 토큰까지 401이면(마커) 서버측 일시 불일치 신호다 — 즉시 Sentry
 *   warning으로 남기고 원 401을 반환한다(화면별 QueryErrorBoundary가 담음, 무음 금지).
 */
export const createTokenRefreshHook = (deps: TokenRefreshHookDeps): AfterResponseHook => {
  const { tokenStore, refresh, endSession } = deps;

  // 새 액세스 토큰과 마커를 실어 강제 재시도한다. `new Request(request, ...)`가 원 요청의
  // body·method·나머지 헤더를 보존하고, Authorization만 갱신된 토큰으로 덮어쓴다.
  const forceRetryWithToken = (request: Request, accessToken: string) => {
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set(RETRY_MARKER_HEADER, '1');
    return ky.retry({ request: new Request(request, { headers }) });
  };

  return async ({ request, response }) => {
    if (response.status !== 401) {
      return response;
    }

    if (request.headers.has(RETRY_MARKER_HEADER)) {
      errorReporter.captureMessage('auth_refresh_retry_rejected', {
        severity: 'warning',
        feature: 'auth_cold_start',
        statusCode: 401,
        endpoint: pathnameOf(request.url ?? ''),
      });
      return response;
    }

    // 읽기 실패는 "토큰 없음"이 아니다 — 아래 갱신 경로가 처리하게 넘긴다.
    const storedAccessToken = await tokenStore.readAccessToken().catch(() => null);
    const sentAuthorization = request.headers.get('Authorization');
    if (storedAccessToken && sentAuthorization !== `Bearer ${storedAccessToken}`) {
      return forceRetryWithToken(request, storedAccessToken);
    }

    const outcome = await refresh();
    switch (outcome.kind) {
      case 'refreshed':
        return forceRetryWithToken(request, outcome.accessToken);
      case 'invalid':
        // 살아있다고 믿던 세션이었는지는 AuthProvider가 판단한다(로그아웃 상태의 401은 잡음).
        await endSession(outcome.details);
        return response;
    }
  };
};

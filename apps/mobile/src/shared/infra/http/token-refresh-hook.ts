import type { SessionExpiredDetails } from '@src/core/ports/telemetry-event';
import type { TokenStore } from '@src/core/ports/token-store';
import type { AfterResponseHook } from 'ky';
import type { TokenRefresher } from './token-refresher';

/** 갱신 후 재시도된 요청 표시 — 재시도가 다시 401이어도 갱신을 반복하지 않는다 */
export const RETRY_MARKER_HEADER = 'x-retried-after-refresh';

/** 세션 종료 확정을 위임하는 포트. 구현은 `SessionManager.end`. */
export type EndSession = (details: SessionExpiredDetails) => Promise<void>;

export interface TokenRefreshHookDeps {
  tokenStore: TokenStore;
  refresh: TokenRefresher;
  endSession: EndSession;
  retry: (request: Request) => Promise<Response>;
}

/**
 * 401 응답 처리 훅.
 *
 * - 갱신 성공 시 원 요청을 인스턴스 훅 경유로 재시도한다. ky는 요청을 clone해서
 *   전송하므로 훅에 전달된 request는 body가 소비되지 않은 원본이다 (POST 재시도 안전).
 * - 이미 다른 flight가 토큰을 회전한 뒤 도착한 401(stale token)은 갱신 없이
 *   바로 재시도한다 — 불필요한 갱신은 서버의 토큰 패밀리를 소모시킨다.
 * - 갱신 실패 시 원 401 응답을 그대로 반환해 ky-client가 ApiError로 일관 번역하게 한다.
 *   이 ApiError는 화면별 `QueryErrorBoundary`가 로컬 재시도로 담는다(앱 레벨로 새지 않음).
 *
 * 세션 종료 여부는 갱신 결과(`RefreshOutcome`)만 보고 판단한다.
 * `transient-failure`(네트워크·5xx·잠긴 키체인)에서는 절대 세션을 끝내지 않는다.
 */
export const createTokenRefreshHook = (deps: TokenRefreshHookDeps): AfterResponseHook => {
  const { tokenStore, refresh, endSession, retry } = deps;

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

    // 읽기 실패는 "토큰 없음"이 아니다 — 아래 갱신 경로가 transient로 처리하게 넘긴다.
    const storedAccessToken = await tokenStore.readAccessToken().catch(() => null);
    const sentAuthorization = request.headers.get('Authorization');
    if (storedAccessToken && sentAuthorization !== `Bearer ${storedAccessToken}`) {
      return retryWithMarker(request);
    }

    const outcome = await refresh();
    switch (outcome.kind) {
      case 'refreshed':
        return retryWithMarker(request);
      case 'session-invalid':
        await endSession(outcome.details);
        return response;
      case 'no-session':
        // 살아있다고 믿던 세션이었는지는 AuthProvider가 판단한다(로그아웃 상태의 401은 잡음).
        await endSession({ reason: 'tokens-missing' });
        return response;
      case 'transient-failure':
        return response;
    }
  };
};

import { ErrorCode, type ErrorCodeType } from '@aido/api/errors';
import type { SessionExpiredDetails } from '@src/core/observability/telemetry-event';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { TokenRefresher } from '@src/core/ports/token-refresher';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { getErrorMessage } from '@src/shared/errors';
import ky, { type AfterResponseHook } from 'ky';
import { match } from 'ts-pattern';

import { getPathname } from './request-path';
import { toServerErrorCode } from './server-error-code';
import { TOKEN_REFRESHER_LOG_EVENT } from './token-refresher-log-events';

/** 재시도가 다시 401이어도 갱신을 반복하지 않는다 */
export const RETRY_MARKER_HEADER = 'x-retried-after-refresh';

/** 토큰·세션이 거부된 401 코드(지금 JWT 가드는 AUTH_0101 하나로 낸다). 비밀번호가 틀린 USER_0602 같은 업무 401은 갱신하지 않는다 */
const ACCESS_TOKEN_REJECTED_CODES: ReadonlySet<ErrorCodeType> = new Set([
  ErrorCode.AUTH_0101,
  ErrorCode.AUTH_0102,
  ErrorCode.AUTH_0103,
  ErrorCode.AUTH_0104,
  ErrorCode.AUTH_0105,
  ErrorCode.AUTH_0106,
  ErrorCode.AUTH_0107,
  ErrorCode.SESSION_0701,
  ErrorCode.SESSION_0702,
  ErrorCode.SESSION_0703,
  ErrorCode.SESSION_0704,
]);

/** 코드를 읽지 못한 401(게이트웨이·본문 없는 응답)은 전처럼 토큰 거부로 본다 */
async function isAccessTokenRejected(response: Response): Promise<boolean> {
  const code = toServerErrorCode(
    await response
      .clone()
      .json()
      .catch(() => null),
  );
  return code == null || ACCESS_TOKEN_REJECTED_CODES.has(code);
}

/** 요청을 보낸 세션의 세대를 ky `context`에 남긴다. 서버로 나가는 헤더에 싣지 않는다 */
const SENT_EPOCH_CONTEXT_KEY = 'sentSessionEpoch';

export function markRequestEpoch(context: Record<string, unknown>, epoch: number): void {
  context[SENT_EPOCH_CONTEXT_KEY] = epoch;
}

/** 세션 종료 확정을 위임하는 포트. 구현은 `SessionManager.end`. */
export type EndSession = (details: SessionExpiredDetails) => Promise<void>;

export interface TokenRefreshHookPorts {
  tokenStore: TokenStore;
  refresh: TokenRefresher;
  endSession: EndSession;
  sessionEpoch: SessionEpoch;
  logger: Pick<AppLogger, 'warn'>;
  errorReporter: Pick<ErrorReporter, 'captureMessage'>;
}

// 재시도 응답 객체를 훅에서 직접 반환하면 안 된다. expo/fetch 응답은 globalThis.Response 인스턴스가 아니라 ky가 버리고 원본 401을 살린다
// 요청을 보낸 뒤 세션이 끝났으면 재시도·갱신하지 않는다. 재시도하면 A의 요청이 저장된 B 토큰으로 실행된다
export function createTokenRefreshHook(deps: TokenRefreshHookPorts): AfterResponseHook {
  const { tokenStore, refresh, endSession, sessionEpoch, logger, errorReporter } = deps;

  // `new Request(request, ...)`가 원 요청의 body·method·헤더를 보존하고 Authorization만 덮어쓴다
  const forceRetryWithToken = (request: Request, accessToken: string) => {
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set(RETRY_MARKER_HEADER, '1');
    return ky.retry({ request: new Request(request, { headers }) });
  };

  return async ({ request, options, response }) => {
    if (response.status !== 401 || !(await isAccessTokenRejected(response))) {
      return response;
    }

    if (request.headers.has(RETRY_MARKER_HEADER)) {
      errorReporter.captureMessage(ERROR_REPORT_MESSAGES.AUTH_REFRESH_RETRY_REJECTED, {
        severity: 'warning',
        feature: 'auth_cold_start',
        statusCode: 401,
        endpoint: getPathname(request.url ?? ''),
      });
      return response;
    }

    const sentEpoch = options.context[SENT_EPOCH_CONTEXT_KEY];
    if (typeof sentEpoch === 'number' && sentEpoch !== sessionEpoch.current()) {
      return response;
    }

    // 읽기 실패는 "토큰 없음"이 아니다 — 아래 갱신 경로가 처리하게 넘긴다.
    const storedAccessToken = await tokenStore.getAccessToken().catch((error: unknown) => {
      logger.warn(TOKEN_REFRESHER_LOG_EVENT.ACCESS_TOKEN_READ_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    });
    const sentAuthorization = request.headers.get('Authorization');
    if (storedAccessToken && sentAuthorization !== `Bearer ${storedAccessToken}`) {
      return forceRetryWithToken(request, storedAccessToken);
    }

    const outcome = await refresh();
    return match(outcome)
      .with({ kind: 'refreshed' }, ({ accessToken }) => forceRetryWithToken(request, accessToken))
      .with({ kind: 'invalid' }, async ({ details }) => {
        // 살아있다고 믿던 세션이었는지는 useAuthBoot가 판단한다(로그아웃 상태의 401은 잡음).
        await endSession(details);
        return response;
      })
      .with({ kind: 'superseded' }, () => response)
      .exhaustive();
  };
}

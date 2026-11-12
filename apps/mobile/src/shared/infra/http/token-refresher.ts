import { refreshTokensSchema } from '@aido/api/contracts/auth';
import { HttpStatus } from '@aido/api/errors';
import type { SessionExpiredDetails } from '@src/core/observability/telemetry-event';
import type { AppLogger } from '@src/core/ports/app-logger';
import type {
  RefreshOutcome,
  RefreshTokensRequest,
  TokenRefresher,
} from '@src/core/ports/token-refresher';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import { getErrorMessage, NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { TimeoutError as DeadlineError, withTimeout } from 'es-toolkit';
import { TimeoutError as KyTimeoutError } from 'ky';
import { z } from 'zod';

import { REFRESH_TIMEOUT_MS, TOKEN_READ_TIMEOUT_MS } from './request-timeout';
import { toServerErrorCode } from './server-error-code';
import { TOKEN_REFRESHER_LOG_EVENT } from './token-refresher-log-events';

const refreshEnvelopeSchema = z.object({ data: refreshTokensSchema });

interface RefreshExchange {
  response: Response;
  /** JSON이 아니면 null이다 */
  body: unknown;
}

interface TokenRefresherPorts {
  tokenStore: TokenStore;
  requestRefresh: RefreshTokensRequest;
  sessionEpoch: SessionEpoch;
  logger: Pick<AppLogger, 'warn'>;
}

// 책임은 갱신뿐이다. 갱신기가 세션을 끝낼 수 있으면 "토큰 삭제는 두 경로뿐"이라는 불변식이 무너진다
// resolve는 확정 판정, reject는 재시도 대상 인프라 장애다
export function createTokenRefresher({
  tokenStore,
  requestRefresh,
  sessionEpoch,
  logger,
}: TokenRefresherPorts): TokenRefresher {
  let inFlight: { epoch: number; outcome: Promise<RefreshOutcome> } | null = null;

  // 멈춘 키체인 읽기가 갱신을 붙잡으면 뒤의 401이 모두 그 갱신에 합류해 회복이 없다. 제한을 넘기면 이 갱신만 일시 장애로 끝낸다
  const readRefreshToken = async (): Promise<string | null> => {
    try {
      return await withTimeout(() => tokenStore.getRefreshToken(), TOKEN_READ_TIMEOUT_MS);
    } catch (error) {
      // 키체인 접근 실패(기기 잠김 등)는 "토큰 없음"이 아니다. 세션을 끝내면 안 된다.
      logger.warn(TOKEN_REFRESHER_LOG_EVENT.TOKEN_READ_FAILED, { error: getErrorMessage(error) });
      throw error instanceof DeadlineError ? new TimeoutError() : new NetworkError();
    }
  };

  // ky timeout은 응답 헤더까지만 센다. 본문이 멈추면 이 갱신을 기다리는 401 요청이 모두 멈추므로 본문까지 같은 제한 안에 받는다
  // 제한을 넘겨 늦게 온 본문은 버린다. 저장하면 그사이 다시 회전한 토큰을 지난 토큰으로 덮는다
  const exchangeRefreshToken = async (refreshToken: string): Promise<RefreshExchange> => {
    try {
      return await withTimeout(async () => {
        const response = await requestRefresh(refreshToken);
        // 갱신 응답은 이 함수 밖으로 나가지 않으므로 본문을 직접 읽어도 안전하다.
        return { response, body: await response.json().catch(() => null) };
      }, REFRESH_TIMEOUT_MS);
    } catch (error) {
      // 네트워크/타임아웃 — 서버는 회전하지 않았거나 grace 안이라 보유 토큰으로 다시 시도할 수 있다.
      logger.warn(TOKEN_REFRESHER_LOG_EVENT.TRANSIENT_REFRESH_FAILED, {
        error: getErrorMessage(error),
      });
      throw error instanceof KyTimeoutError || error instanceof DeadlineError
        ? new TimeoutError()
        : new NetworkError();
    }
  };

  const refresh = async (epoch: number): Promise<RefreshOutcome> => {
    const concludeInvalid = (details: SessionExpiredDetails): RefreshOutcome =>
      sessionEpoch.current() === epoch ? { kind: 'invalid', details } : { kind: 'superseded' };

    const refreshToken = await readRefreshToken();

    if (!refreshToken) {
      return concludeInvalid({ reason: 'tokens-missing' });
    }

    const { response, body } = await exchangeRefreshToken(refreshToken);

    if (response.ok) {
      const parsed = refreshEnvelopeSchema.safeParse(body);
      if (!parsed.success) {
        // 2xx = 서버는 이미 회전을 마쳤다. 새 토큰을 읽지 못하면 보유 토큰은 곧 무효다.
        return concludeInvalid({ reason: 'invalid-refresh-response' });
      }

      if (sessionEpoch.current() !== epoch) {
        return { kind: 'superseded' };
      }

      const { accessToken, refreshToken: nextRefreshToken } = parsed.data.data;
      // 기다리는 요청은 키체인 쓰기를 기다리지 않고 새 토큰으로 바로 다시 보낸다. 저장소는 부른 즉시 새 토큰을 읽어 준다(TokenStore.save)
      // 실패로 던지지 않는다. 기다리던 요청이 실패한 채 다시 갱신하면 회전 전 refresh 토큰을 보내 grace 뒤 SESSION_0704가 된다
      tokenStore.save({ accessToken, refreshToken: nextRefreshToken }).catch((error: unknown) => {
        logger.warn(TOKEN_REFRESHER_LOG_EVENT.TOKEN_PERSIST_FAILED, {
          error: getErrorMessage(error),
        });
      });
      return { kind: 'refreshed', accessToken };
    }

    if (response.status === HttpStatus.UNAUTHORIZED) {
      // 서버가 리프레시 토큰 자체를 거부했다. 어떤 코드인지가 진단의 전부다 —
      // SESSION_0704(토큰 재사용 → 패밀리 폐기)와 SESSION_0702(단순 만료)는 전혀 다른 사건이다.
      return concludeInvalid({
        reason: 'refresh-rejected',
        serverErrorCode: toServerErrorCode(body),
      });
    }

    // 429/기타 4xx/5xx — 토큰은 아직 유효할 수 있으므로 보존하고 재시도 대상으로 던진다.
    logger.warn(TOKEN_REFRESHER_LOG_EVENT.TRANSIENT_REFRESH_FAILED, { status: response.status });
    throw new ServerError(response.status);
  };

  return () => {
    const epoch = sessionEpoch.current();
    if (inFlight?.epoch === epoch) {
      return inFlight.outcome;
    }
    const outcome = refresh(epoch).finally(() => {
      if (inFlight?.outcome === outcome) {
        inFlight = null;
      }
    });
    inFlight = { epoch, outcome };
    return outcome;
  };
}

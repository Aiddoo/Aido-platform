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
import { TimeoutError as KyTimeoutError } from 'ky';
import { z } from 'zod';

import { toServerErrorCode } from './server-error-code';
import { TOKEN_REFRESHER_LOG_EVENT } from './token-refresher-log-events';

const refreshEnvelopeSchema = z.object({ data: refreshTokensSchema });

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

  const readRefreshToken = async (): Promise<string | null> => {
    try {
      return await tokenStore.getRefreshToken();
    } catch (error) {
      // 키체인 접근 실패(기기 잠김 등)는 "토큰 없음"이 아니다. 세션을 끝내면 안 된다.
      logger.warn(TOKEN_REFRESHER_LOG_EVENT.TOKEN_READ_FAILED, { error: getErrorMessage(error) });
      throw new NetworkError();
    }
  };

  const sendRefreshRequest = async (refreshToken: string): Promise<Response> => {
    try {
      return await requestRefresh(refreshToken);
    } catch (error) {
      // 네트워크/타임아웃 — 서버는 회전하지 않았으므로 보유 토큰은 여전히 유효하다.
      logger.warn(TOKEN_REFRESHER_LOG_EVENT.TRANSIENT_REFRESH_FAILED, {
        error: getErrorMessage(error),
      });
      throw error instanceof KyTimeoutError ? new TimeoutError() : new NetworkError();
    }
  };

  const refresh = async (epoch: number): Promise<RefreshOutcome> => {
    const concludeInvalid = (details: SessionExpiredDetails): RefreshOutcome =>
      sessionEpoch.current() === epoch ? { kind: 'invalid', details } : { kind: 'superseded' };

    const refreshToken = await readRefreshToken();

    if (!refreshToken) {
      return concludeInvalid({ reason: 'tokens-missing' });
    }

    const response = await sendRefreshRequest(refreshToken);

    // 갱신 응답은 이 함수 밖으로 나가지 않으므로 본문을 직접 읽어도 안전하다.
    const body = await response.json().catch(() => null);

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
      try {
        await tokenStore.save({ accessToken, refreshToken: nextRefreshToken });
      } catch (error) {
        // 저장 실패. 서버는 회전했지만 보유 토큰은 grace(10초) 안에서 아직 통한다.
        logger.warn(TOKEN_REFRESHER_LOG_EVENT.TOKEN_PERSIST_FAILED, {
          error: getErrorMessage(error),
        });
        throw new NetworkError();
      }
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

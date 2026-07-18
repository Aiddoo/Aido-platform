import { refreshTokensSchema } from '@aido/validators';
import type { SessionExpiredDetails } from '@src/core/ports/telemetry-event';
import type { TokenStore } from '@src/core/ports/token-store';
import { errorMessageOf, NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { logger } from '@src/shared/infra/logger/global-logger';
import { TimeoutError as KyTimeoutError } from 'ky';
import { z } from 'zod';
import { toServerErrorCode } from './server-error-code';

const refreshEnvelopeSchema = z.object({ data: refreshTokensSchema });

/** 리프레시 요청 포트. 소비자(갱신기)가 선언하고 인프라(`refresh-tokens-request`)가 구현한다. */
export type RefreshTokensRequest = (refreshToken: string) => Promise<Response>;

/**
 * 갱신 시도의 판정.
 *
 * - `refreshed`: 새 토큰 쌍을 저장했다. 재시도 훅이 재시도 요청에 주입할 새 액세스
 *   토큰을 함께 싣는다(ky v2의 beforeRequest는 재시도 시 다시 실행되지 않는다).
 * - `invalid`: 세션 종료가 확정적이다(서버 거부·응답 스키마 위반·로컬 토큰 없음).
 *   서버가 준 `ErrorCode`가 있으면 그대로 실어 보낸다(진실의 원천은 서버다).
 *
 * 일시 실패(네트워크·타임아웃·429/5xx·키체인 잠김·저장 실패)는 판정이 아니라 **인프라
 * 에러로 throw**된다 — 보유 토큰은 유효하므로 React Query의 재시도 정책이 처리한다.
 */
export type RefreshOutcome =
  | { kind: 'refreshed'; accessToken: string }
  | { kind: 'invalid'; details: SessionExpiredDetails };

export type TokenRefresher = () => Promise<RefreshOutcome>;

interface TokenRefresherDeps {
  tokenStore: TokenStore;
  requestRefresh: RefreshTokensRequest;
}

/**
 * 액세스 토큰 갱신기.
 *
 * **책임은 갱신뿐이다.** 이 파일에 토큰 삭제도, 이벤트 발행도 없다 —
 * 세션 종료는 `SessionManager`의 책임이며, 갱신기는 판정 결과를 타입으로 보고할 뿐이다.
 * (갱신기가 세션을 끝낼 수 있으면 "토큰 삭제는 두 경로뿐"이라는 불변식이 무너진다.)
 *
 * resolve = 확정 판정(refreshed/invalid), reject = 일시 인프라 장애(재시도 대상).
 * 동시 대기자들은 single-flight로 동일한 결과(성공이든 실패든)를 공유한다.
 */
export const createTokenRefresher = ({
  tokenStore,
  requestRefresh,
}: TokenRefresherDeps): TokenRefresher => {
  let inFlight: Promise<RefreshOutcome> | null = null;

  const refresh = async (): Promise<RefreshOutcome> => {
    let refreshToken: string | null;
    try {
      refreshToken = await tokenStore.readRefreshToken();
    } catch (error) {
      // 키체인 접근 실패(기기 잠김 등)는 "토큰 없음"이 아니다. 세션을 끝내면 안 된다.
      logger.warn('[TokenRefresher] 토큰 읽기 실패 (세션 보존)', { error: errorMessageOf(error) });
      throw new NetworkError();
    }

    if (!refreshToken) {
      return { kind: 'invalid', details: { reason: 'tokens-missing' } };
    }

    let response: Response;
    try {
      response = await requestRefresh(refreshToken);
    } catch (error) {
      // 네트워크/타임아웃 — 서버는 회전하지 않았으므로 보유 토큰은 여전히 유효하다.
      logger.warn('[TokenRefresher] 일시적 갱신 실패 (토큰 보존)', {
        error: errorMessageOf(error),
      });
      throw error instanceof KyTimeoutError ? new TimeoutError() : new NetworkError();
    }

    // 갱신 응답은 이 함수 밖으로 나가지 않으므로 본문을 직접 읽어도 안전하다.
    const body = await response.json().catch(() => null);

    if (response.ok) {
      const parsed = refreshEnvelopeSchema.safeParse(body);
      if (!parsed.success) {
        // 2xx = 서버는 이미 회전을 마쳤다. 새 토큰을 읽지 못하면 보유 토큰은 곧 무효다.
        return { kind: 'invalid', details: { reason: 'invalid-refresh-response' } };
      }

      const { accessToken, refreshToken: nextRefreshToken } = parsed.data.data;
      try {
        await tokenStore.save({ accessToken, refreshToken: nextRefreshToken });
      } catch (error) {
        // 저장 실패. 서버는 회전했지만 보유 토큰은 grace(10초) 안에서 아직 통한다.
        logger.warn('[TokenRefresher] 새 토큰 저장 실패', { error: errorMessageOf(error) });
        throw new NetworkError();
      }
      return { kind: 'refreshed', accessToken };
    }

    if (response.status === 401) {
      // 서버가 리프레시 토큰 자체를 거부했다. 어떤 코드인지가 진단의 전부다 —
      // SESSION_0704(토큰 재사용 → 패밀리 폐기)와 SESSION_0702(단순 만료)는 전혀 다른 사건이다.
      return {
        kind: 'invalid',
        details: { reason: 'refresh-rejected', serverErrorCode: toServerErrorCode(body) },
      };
    }

    // 429/기타 4xx/5xx — 토큰은 아직 유효할 수 있으므로 보존하고 재시도 대상으로 던진다.
    logger.warn('[TokenRefresher] 일시적 갱신 실패 (토큰 보존)', { status: response.status });
    throw new ServerError(response.status);
  };

  return () => {
    if (inFlight) {
      return inFlight;
    }
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
};

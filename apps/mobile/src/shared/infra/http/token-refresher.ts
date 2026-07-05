import { refreshTokensSchema } from '@aido/validators';
import { emitSessionExpired } from '@src/core/events/session-expired';
import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import { logger } from '@src/shared/infra/logger/global-logger';
import ky from 'ky';
import { z } from 'zod';

const refreshEnvelopeSchema = z.object({ data: refreshTokensSchema });

export type TokenRefresher = () => Promise<boolean>;

/**
 * 액세스 토큰 갱신기. 결과는 항상 boolean으로 resolve하며 reject하지 않는다
 * (동시 대기자들이 동일한 실패 경로를 타도록).
 *
 * 실패 분류:
 * - definitive (401 · 응답 파싱 실패 · 리프레시 토큰 부재): 세션 종료 확정.
 *   토큰 삭제 + sessionExpired 이벤트 발행.
 * - transient (네트워크 · 타임아웃 · 429 · 5xx): 서버가 토큰을 로테이션하지 않았으므로
 *   보유 중인 리프레시 토큰은 여전히 유효하다. 토큰을 보존하고 다음 401에서 재시도.
 */
export const createTokenRefresher = (storage: Storage): TokenRefresher => {
  let inFlight: Promise<boolean> | null = null;

  const expireSession = async (reason: string): Promise<false> => {
    logger.warn('[TokenRefresher] 세션 만료 확정', { reason });
    await Promise.all([storage.remove('accessToken'), storage.remove('refreshToken')]);
    emitSessionExpired();
    return false;
  };

  const refresh = async (): Promise<boolean> => {
    const refreshToken = await storage.get<string>('refreshToken');
    if (!refreshToken) {
      return expireSession('no-refresh-token');
    }

    let response: Response;
    try {
      response = await ky.post('v1/auth/refresh', {
        prefixUrl: ENV.API_URL,
        retry: 0,
        timeout: 10_000,
        throwHttpErrors: false,
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // 네트워크/타임아웃 — 서버는 로테이션하지 않았으므로 토큰 보존
      logger.warn('[TokenRefresher] 일시적 갱신 실패 (토큰 보존)', { error: String(error) });
      return false;
    }

    if (response.ok) {
      const parsed = refreshEnvelopeSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) {
        // 2xx = 서버는 이미 로테이션 완료. 새 토큰을 읽지 못하면 보유 토큰은 곧 무효.
        return expireSession('invalid-refresh-response');
      }
      const { accessToken, refreshToken: nextRefreshToken } = parsed.data.data;
      await Promise.all([
        storage.set('accessToken', accessToken),
        storage.set('refreshToken', nextRefreshToken),
      ]);
      return true;
    }

    if (response.status === 401) {
      // 서버가 리프레시 토큰 자체를 거부 (AUTH_0104/0105, SESSION_0701~0704)
      return expireSession(`refresh-rejected-401`);
    }

    // 429/기타 4xx/5xx — 토큰은 아직 유효할 수 있으므로 보존
    logger.warn('[TokenRefresher] 일시적 갱신 실패 (토큰 보존)', { status: response.status });
    return false;
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

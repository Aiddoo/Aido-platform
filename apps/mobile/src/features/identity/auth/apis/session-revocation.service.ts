import type { HttpClient } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import { HOUR_MS } from '@src/shared/constants/time-units';
import { getErrorMessage } from '@src/shared/errors';

import { AUTH_LOG_EVENT } from '../constants/auth-log-events';
import {
  type PendingRevocation,
  refreshEnvelopeSchema,
} from '../schemas/pending-revocation.schema';
import type { PendingRevocationRepository } from './pending-revocation.repository';

/**
 * 로그아웃했는데 서버에 알리지 못한 세션을 해제할 수 있는 시간.
 * 지나면 토큰을 버리고 서버 세션은 refresh 만료(최대 7일)에 맡긴다.
 *
 * 로그아웃한 기기에 refresh 토큰이 남는 시간이라 짧을수록 좋다. 가장 긴 직항 비행(약 19시간)과
 * 지하철·해외 도착 직후 복귀를 덮는 하루로 둔다. 더 긴 오프라인은 드물고, 그 사이 세션을 풀지
 * 못한 대가는 다음 로그인 또는 refresh 만료까지 이전 계정 알림이 오는 것이다.
 */
export const PENDING_REVOCATION_TTL_MS = 24 * HOUR_MS;

const LOGOUT_TIMEOUT_MS = 5_000;
const TOO_MANY_REQUESTS_STATUS = 429;
const SERVER_ERROR_STATUS = 500;

interface SessionRevocationServicePorts {
  repository: PendingRevocationRepository;
  requestRefresh: RefreshTokensRequest;
  /**
   * 공개 클라이언트여야 한다. 인증 클라이언트는 401에 저장된 토큰으로 갱신하고 세션을 끝내므로
   * 지난 계정의 해제 실패가 지금 로그인한 계정을 로그아웃시킬 수 있다.
   */
  publicHttpClient: Pick<HttpClient, 'post'>;
  logger: Pick<Logger, 'info' | 'warn'>;
  now: () => number;
}

/**
 * 오프라인 로그아웃의 서버 쪽 마무리.
 * 토큰을 지운 뒤에는 인증 요청을 보낼 수 없어 refresh 토큰을 따로 남겼다가, 온라인이 되면
 * 그 토큰으로 access 토큰을 받아 `POST v1/auth/logout`을 부른다. 세션과 푸시 기기가 함께 풀린다.
 * 현재 세션의 토큰 저장소와 세션 상태는 건드리지 않는다.
 */
export class SessionRevocationService {
  readonly #repository: PendingRevocationRepository;
  readonly #requestRefresh: RefreshTokensRequest;
  readonly #publicHttpClient: Pick<HttpClient, 'post'>;
  readonly #logger: Pick<Logger, 'info' | 'warn'>;
  readonly #now: () => number;
  #inFlight: Promise<void> | null = null;

  constructor({
    repository,
    requestRefresh,
    publicHttpClient,
    logger,
    now,
  }: SessionRevocationServicePorts) {
    this.#repository = repository;
    this.#requestRefresh = requestRefresh;
    this.#publicHttpClient = publicHttpClient;
    this.#logger = logger;
    this.#now = now;
  }

  record = (refreshToken: string): Promise<void> =>
    this.#repository.save({
      refreshToken,
      expiresAt: this.#now() + PENDING_REVOCATION_TTL_MS,
    });

  /** 던지지 않는다. 일시 실패면 기록을 남겨 다음 복귀 때 다시 시도한다 */
  flush = (): Promise<void> => {
    if (this.#inFlight == null) {
      this.#inFlight = this.#revoke()
        .catch((error: unknown) => {
          // 오프라인·잠금 중 시작에서 늘 일어나는 일이라 경고로 올리지 않는다
          this.#logger.info(AUTH_LOG_EVENT.SESSION_REVOCATION_DEFERRED, {
            error: getErrorMessage(error),
          });
        })
        .finally(() => {
          this.#inFlight = null;
        });
    }
    return this.#inFlight;
  };

  #revoke = async (): Promise<void> => {
    const pending = await this.#repository.get();
    if (pending == null) {
      return;
    }
    if (this.#now() >= pending.expiresAt) {
      this.#logger.info(AUTH_LOG_EVENT.SESSION_REVOCATION_EXPIRED);
      await this.#repository.clear();
      return;
    }

    const accessToken = await this.#issueAccessToken(pending);
    if (accessToken == null) {
      await this.#repository.clear();
      return;
    }

    const result = await this.#publicHttpClient.post('v1/auth/logout', undefined, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: LOGOUT_TIMEOUT_MS,
    });
    if (!result.ok) {
      this.#logger.warn(AUTH_LOG_EVENT.SESSION_REVOCATION_REJECTED, { code: result.error.code });
    }
    await this.#repository.clear();
  };

  /** 세션이 이미 끝났으면 null. 일시 실패는 던져 기록을 남긴다 */
  #issueAccessToken = async (pending: PendingRevocation): Promise<string | null> => {
    const response = await this.#requestRefresh(pending.refreshToken);

    if (response.status === TOO_MANY_REQUESTS_STATUS || response.status >= SERVER_ERROR_STATUS) {
      throw new Error(`refresh status ${response.status}`);
    }
    if (!response.ok) {
      this.#logger.info(AUTH_LOG_EVENT.SESSION_REVOCATION_ALREADY_ENDED, {
        status: response.status,
      });
      return null;
    }

    const parsed = refreshEnvelopeSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      this.#logger.warn(AUTH_LOG_EVENT.SESSION_REVOCATION_REJECTED, {
        code: 'invalid-refresh-response',
      });
      return null;
    }

    // 서버가 회전했다. 로그아웃이 실패해도 다음 시도가 재사용 감지에 걸리지 않게 새 토큰을 남긴다
    await this.#repository.save({ ...pending, refreshToken: parsed.data.data.refreshToken });
    return parsed.data.data.accessToken;
  };
}

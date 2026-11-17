import type { UserRole } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";

import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import { assertStatusAllowsLogin } from "../../../users/domain/account-status.domain-service.js";
import { SessionId } from "../../domain/session-id.vo.js";
import {
  getSessionValidity,
  type SessionValidity,
} from "../../domain/session-validity.domain-service.js";
import type { CachedSession, SessionCachePort } from "../ports/session-cache.port.js";
import type { SessionRepositoryPort } from "../ports/session.repository.port.js";
import { invalidAccessToken, sessionNotFound, sessionRejection } from "../sessions.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";

// 서명·만료를 검증한 access 토큰의 claim. 타입·세션 확인은 이 UseCase가 한다
export interface AccessTokenClaims {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly type?: string;
  readonly sessionId?: string;
}

export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
  readonly sessionId: string;
  readonly role: UserRole;
}

export interface AuthenticateSessionDependencies {
  readonly sessionRepository: Pick<SessionRepositoryPort, "findById">;
  readonly userRepository: Pick<UserRepositoryPort, "findById">;
  readonly clock: ClockPort;
  readonly cache: Pick<SessionCachePort, "wrapSession">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/**
 * 서명이 맞는 access 토큰의 세션이 아직 살아 있는지 확인한다. 로그아웃·폐기 뒤 토큰을 막으려고
 * 세션을 30초 캐시(cache-aside)로 읽고, 세션이 유효해도 잠금·정지·탈퇴 사용자는 거절한다.
 */
export class AuthenticateSessionUseCase {
  readonly #dependencies: AuthenticateSessionDependencies;

  constructor(dependencies: AuthenticateSessionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(claims: AccessTokenClaims): Promise<AuthenticatedUser> {
    if (claims.type !== "access") {
      throw invalidAccessToken("Not an access token");
    }
    if (!claims.sessionId) {
      throw invalidAccessToken("Missing sessionId");
    }

    const sessionId = SessionId.reconstitute(claims.sessionId);
    // 캐시 값은 저장한 뒤 만료됐을 수 있어 꺼낼 때마다 다시 판단한다
    this.#assertUsable(await this.#readSession(sessionId), sessionId);
    return {
      userId: claims.sub,
      email: claims.email,
      sessionId: claims.sessionId,
      role: claims.role,
    };
  }

  // 인증은 마지막 방어선이라 캐시 장애는 미스로 보고 DB에서 읽는다. factory의 거절·DB 오류는 그대로 던진다
  async #readSession(sessionId: SessionId): Promise<CachedSession> {
    const loading: { session: Promise<CachedSession> | null } = { session: null };
    try {
      return await this.#dependencies.cache.wrapSession(sessionId, () => {
        loading.session = this.#loadUsableSession(sessionId);
        return loading.session;
      });
    } catch (error) {
      if (loading.session == null) {
        this.#dependencies.logger.warn({
          event: SessionLogEvent.SESSION_CACHE_READ_FAILED,
          errorType: toErrorType(error),
        });
        return this.#loadUsableSession(sessionId);
      }
      const loaded = await loading.session;
      this.#dependencies.logger.warn({
        event: SessionLogEvent.SESSION_CACHE_WRITE_FAILED,
        errorType: toErrorType(error),
      });
      return loaded;
    }
  }

  // 쓸 수 없는 세션·사용자는 캐시에 두지 않도록 저장 전에 거절한다
  async #loadUsableSession(sessionId: SessionId): Promise<CachedSession> {
    const session = await this.#dependencies.sessionRepository.findById(sessionId);
    if (session == null) {
      throw sessionNotFound(sessionId.value);
    }
    this.#assertValid(session.validityAt(this.#dependencies.clock.now()), sessionId);

    const user = await this.#dependencies.userRepository.findById(session.userId);
    const loaded: CachedSession = {
      userId: session.userId,
      expiresAt: toIsoString(session.expiresAt),
      revokedAt: session.revokedAt == null ? null : toIsoString(session.revokedAt),
      userStatus: user?.status,
      userDeletedAt: user?.deletedAt == null ? null : toIsoString(user.deletedAt),
    };
    assertUserAllowed(loaded);
    return loaded;
  }

  #assertUsable(session: CachedSession, sessionId: SessionId): void {
    this.#assertValid(
      getSessionValidity({
        expiresAt: toInstant(session.expiresAt),
        revokedAt: session.revokedAt == null ? null : toInstant(session.revokedAt),
        now: this.#dependencies.clock.now(),
      }),
      sessionId,
    );
    assertUserAllowed(session);
  }

  #assertValid(validity: SessionValidity, sessionId: SessionId): void {
    const rejection = sessionRejection(validity, sessionId.value);
    if (rejection != null) {
      throw rejection;
    }
  }
}

function assertUserAllowed(session: CachedSession): void {
  if (session.userStatus) {
    assertStatusAllowsLogin(
      session.userStatus,
      "User",
      session.userDeletedAt != null && session.userDeletedAt !== "",
    );
  }
}

// 메모리 캐시는 Date, Redis 캐시는 ISO 문자열을 돌려준다
function toInstant(value: Date | string): Temporal.Instant {
  return value instanceof Date ? instantFromDate(value) : Temporal.Instant.from(value);
}

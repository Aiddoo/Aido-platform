import { ErrorCode } from "@aido/api/errors";
import type { UserRole } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";

import { SessionId } from "../../domain/session-id.vo.js";
import { getSessionValidity } from "../../domain/session-validity.domain-service.js";
import { sessionRejection } from "../auth.errors.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachedSession, AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";

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
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "findById">;
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById">;
  readonly clock: ClockPort;
  readonly cache: Pick<AuthCachePort, "getSession" | "setSession">;
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
    const { sessionRepository, userRepository } = this.#dependencies;
    if (claims.type !== "access") {
      throw new ApplicationException(ErrorCode.AUTH_0101, { reason: "Not an access token" });
    }
    if (!claims.sessionId) {
      throw new ApplicationException(ErrorCode.AUTH_0101, { reason: "Missing sessionId" });
    }
    const authenticated: AuthenticatedUser = {
      userId: claims.sub,
      email: claims.email,
      sessionId: claims.sessionId,
      role: claims.role,
    };

    const sessionId = SessionId.reconstitute(claims.sessionId);
    const cachedSession = await this.#readCachedSession(sessionId);
    if (cachedSession != null) {
      this.#assertUsable(
        getSessionValidity({
          expiresAt: toInstant(cachedSession.expiresAt),
          revokedAt: cachedSession.revokedAt == null ? null : toInstant(cachedSession.revokedAt),
          now: this.#dependencies.clock.now(),
        }),
        claims.sessionId,
      );
      if (cachedSession.userStatus) {
        assertUserStatus(cachedSession.userStatus, cachedSession.userDeletedAt);
      }
      return authenticated;
    }

    const session = await sessionRepository.findById(sessionId);
    this.#assertUsable(
      session == null ? "missing" : session.validityAt(this.#dependencies.clock.now()),
      claims.sessionId,
    );
    if (session == null) {
      return authenticated;
    }

    const user = await userRepository.findById(session.userId);
    const userStatus = user?.status;
    const userDeletedAt = user?.deletedAt == null ? null : toIsoString(user.deletedAt);
    if (userStatus) {
      assertUserStatus(userStatus, userDeletedAt);
    }

    await this.#writeCachedSession(sessionId, {
      userId: session.userId.value,
      expiresAt: toIsoString(session.expiresAt),
      revokedAt: session.revokedAt == null ? null : toIsoString(session.revokedAt),
      userStatus,
      userDeletedAt,
    });
    return authenticated;
  }

  #assertUsable(validity: Parameters<typeof sessionRejection>[0], sessionId: string): void {
    const rejection = sessionRejection(validity, sessionId);
    if (rejection != null) {
      throw rejection;
    }
  }

  // 인증은 마지막 방어선이라 캐시 장애는 미스로 본다. try 안에는 캐시 I/O만 두어 의도한 401을 삼키지 않는다
  async #readCachedSession(sessionId: SessionId): Promise<AuthCachedSession | undefined> {
    try {
      return await this.#dependencies.cache.getSession(sessionId);
    } catch (error) {
      this.#dependencies.logger.warn({
        event: AuthLogEvent.SESSION_CACHE_READ_FAILED,
        errorType: toErrorType(error),
      });
      return undefined;
    }
  }

  // 저장 실패는 다음 요청이 DB를 다시 읽을 뿐이라 무시한다
  async #writeCachedSession(sessionId: SessionId, session: AuthCachedSession): Promise<void> {
    try {
      await this.#dependencies.cache.setSession(sessionId, session);
    } catch (error) {
      this.#dependencies.logger.warn({
        event: AuthLogEvent.SESSION_CACHE_WRITE_FAILED,
        errorType: toErrorType(error),
      });
    }
  }
}

// 메모리 캐시는 Date, Redis 캐시는 ISO 문자열을 돌려준다
function toInstant(value: Date | string): Temporal.Instant {
  return value instanceof Date ? instantFromDate(value) : Temporal.Instant.from(value);
}

function assertUserStatus(status: string, deletedAt: string | null | undefined): void {
  if (status === "LOCKED") {
    throw new ApplicationException(ErrorCode.USER_0607, {
      email: "User",
      remainingMinutes: undefined,
    });
  }
  if (status === "SUSPENDED" || deletedAt) {
    throw new ApplicationException(ErrorCode.USER_0605, { userId: "User" });
  }
}

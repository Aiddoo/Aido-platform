import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addMilliseconds } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { AuthSession } from "../../../domain/aggregates/auth/auth-session.aggregate.js";
import {
  AUTH_DEFAULTS,
  REVOKE_REASON,
  SECURITY_EVENT,
  TOKEN_REUSE_GRACE_PERIOD_MS,
} from "../../../domain/constants/auth/auth.constants.js";
import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthTokenIssuerPort } from "../../ports/auth/auth-crypto.port.js";
import type {
  AuthSecurityLogRepositoryPort,
  AuthSessionRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type {
  RefreshTokensResult,
  RequestMetadata,
  VerifiedRefreshPayload,
} from "../../types/auth/index.js";

export interface RefreshTokensInput {
  readonly refreshToken: string;
  readonly verifiedPayload: VerifiedRefreshPayload;
  readonly metadata?: RequestMetadata;
}

interface RefreshTokensDependencies {
  readonly sessionRepository: Pick<
    AuthSessionRepositoryPort,
    "findByRefreshTokenHash" | "findById" | "rotateToken" | "revokeByTokenFamily"
  >;
  readonly tokenService: Pick<
    AuthTokenIssuerPort,
    "hashRefreshToken" | "generateTokenPair" | "getRefreshTokenExpiresInSeconds"
  >;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly logger: ApplicationLogger;
}

export class RefreshTokens {
  readonly #dependencies: RefreshTokensDependencies;

  constructor(dependencies: RefreshTokensDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RefreshTokensInput): Promise<RefreshTokensResult> {
    const { sessionId } = input.verifiedPayload;
    if (!sessionId) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    const refreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(input.refreshToken);
    const session =
      await this.#dependencies.sessionRepository.findByRefreshTokenHash(refreshTokenHash);
    if (session !== null) {
      return this.#rotateSession(AuthSession.reconstitute(session), input, false);
    }

    const currentSession = await this.#dependencies.sessionRepository.findById(sessionId);
    if (currentSession === null) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }
    const authSession = AuthSession.reconstitute(currentSession);
    if (!authSession.wasPreviouslyIssued(refreshTokenHash)) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    if (authSession.isRetryWithin(refreshTokenHash, now(), TOKEN_REUSE_GRACE_PERIOD_MS)) {
      return this.#rotateSession(authSession, input, true);
    }

    const revokedSessionIds = await this.#dependencies.sessionRepository.revokeByTokenFamily(
      authSession.tokenFamily,
      REVOKE_REASON.TOKEN_REUSE_DETECTED,
    );
    await Promise.all(
      revokedSessionIds.map((id) => this.#dependencies.cacheService.invalidateSession(id)),
    );
    await this.#dependencies.securityLogRepository.create({
      userId: authSession.userId,
      event: SECURITY_EVENT.SUSPICIOUS_ACTIVITY,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: {
        reason: REVOKE_REASON.TOKEN_REUSE_DETECTED,
        tokenFamily: authSession.tokenFamily,
      },
    });
    this.#dependencies.logger.warn({
      event: IdentityLogEvent.SESSION_TOKEN_REUSE_DETECTED,
      userId: authSession.userId,
      sessionId,
      revokedCount: revokedSessionIds.length,
    });
    throw new ApplicationException(ErrorCode.SESSION_0704, { tokenFamily: undefined });
  }

  async #rotateSession(
    session: AuthSession,
    input: RefreshTokensInput,
    retryWithinGracePeriod: boolean,
  ): Promise<RefreshTokensResult> {
    const validity = session.validityAt(now());
    if (validity === "revoked") {
      throw new ApplicationException(ErrorCode.SESSION_0703, {
        sessionId: undefined,
        reason: undefined,
      });
    }
    if (validity === "expired") {
      throw new ApplicationException(ErrorCode.SESSION_0702, { sessionId: undefined });
    }

    const { userId, email, sessionId, role } = input.verifiedPayload;
    if (!session.isOwnedBy(userId) || session.id !== sessionId) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    const tokens = await this.#dependencies.tokenService.generateTokenPair(
      userId,
      email,
      sessionId,
      role,
      session.tokenFamily,
      session.tokenVersion + 1,
    );
    const refreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(tokens.refreshToken);
    const refreshExpiresInSeconds =
      this.#dependencies.tokenService.getRefreshTokenExpiresInSeconds();
    // 현재 hash를 이전 hash로 저장해야 동일한 옛 토큰의 재시도는 한 번만 허용된다.
    const rotation = session.planRotation(
      refreshTokenHash,
      session.refreshTokenHash,
      addMilliseconds(refreshExpiresInSeconds * 1000),
    );
    const rotatedSession = await this.#dependencies.sessionRepository.rotateToken(
      sessionId,
      rotation,
    );
    if (rotatedSession === null) {
      this.#dependencies.logger.warn({
        event: IdentityLogEvent.SESSION_ROTATION_CONFLICT,
        userId,
        sessionId,
      });
      throw new ApplicationException(ErrorCode.SESSION_0702, { sessionId: undefined });
    }

    await this.#dependencies.cacheService.invalidateSession(sessionId);
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.TOKEN_REFRESH,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      ...(retryWithinGracePeriod && { metadata: { retryWithinGracePeriod: true } }),
    });
    this.#dependencies.logger.debug({
      event: IdentityLogEvent.SESSION_TOKENS_REFRESHED,
      userId,
      sessionId,
      retryWithinGracePeriod,
    });
    return { tokens, sessionId };
  }
}

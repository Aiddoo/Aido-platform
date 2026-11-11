import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON, SECURITY_EVENT, type UserRole } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AuthSession } from "../../domain/auth-session.aggregate.js";
import { AUTH_DEFAULTS, TOKEN_REUSE_GRACE_PERIOD_MS } from "../../domain/auth.constants.js";
import { SessionId } from "../../domain/session-id.vo.js";
import { AuthAlerts } from "../auth.alerts.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthTokenIssuerPort } from "../ports/auth-crypto.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type {
  RefreshTokensResult,
  RequestMetadata,
  VerifiedRefreshPayload,
} from "../read-models/auth-result.read-model.js";

export interface RefreshTokensCommand {
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
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
  readonly alert: Pick<OperationalAlertPort, "raise">;
}

export class RefreshTokensUseCase {
  readonly #dependencies: RefreshTokensDependencies;

  constructor(dependencies: RefreshTokensDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RefreshTokensCommand): Promise<RefreshTokensResult> {
    const { sessionId } = input.verifiedPayload;
    if (!sessionId) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    const refreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(input.refreshToken);
    const session =
      await this.#dependencies.sessionRepository.findByRefreshTokenHash(refreshTokenHash);
    if (session != null) {
      return this.#rotateSession(session, input, false);
    }

    const authSession = await this.#dependencies.sessionRepository.findById(
      SessionId.reconstitute(sessionId),
    );
    if (authSession == null || !authSession.wasPreviouslyIssued(refreshTokenHash)) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    if (
      authSession.isRetryWithin(
        refreshTokenHash,
        this.#dependencies.clock.now(),
        TOKEN_REUSE_GRACE_PERIOD_MS,
      )
    ) {
      return this.#rotateSession(authSession, input, true);
    }

    const revokedSessionIds = await this.#dependencies.sessionRepository.revokeByTokenFamily(
      authSession.tokenFamily,
      REVOKE_REASON.TOKEN_REUSE_DETECTED,
      this.#dependencies.clock.now(),
    );
    await Promise.all(
      revokedSessionIds.map((id) => this.#dependencies.cacheService.invalidateSession(id)),
    );
    await this.#dependencies.pushDevices.releaseSessions(revokedSessionIds);
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
      event: AuthLogEvent.SESSION_TOKEN_REUSE_DETECTED,
      userId: authSession.userId.value,
      sessionId,
      revokedCount: revokedSessionIds.length,
    });
    // 유출 의심 신호다. 사용자 ID는 로그에만 두고 경보에는 끊은 세션 수만 싣는다
    this.#dependencies.alert.raise({
      ...AuthAlerts.REFRESH_TOKEN_REUSED,
      details: { revokedCount: revokedSessionIds.length },
    });
    throw new ApplicationException(ErrorCode.SESSION_0704, { tokenFamily: undefined });
  }

  async #rotateSession(
    session: AuthSession,
    input: RefreshTokensCommand,
    retryWithinGracePeriod: boolean,
  ): Promise<RefreshTokensResult> {
    const now = this.#dependencies.clock.now();
    const validity = session.validityAt(now);
    if (validity === "revoked") {
      throw new ApplicationException(ErrorCode.SESSION_0703, {
        sessionId: undefined,
        reason: undefined,
      });
    }
    if (validity === "expired") {
      throw new ApplicationException(ErrorCode.SESSION_0702, { sessionId: undefined });
    }

    const { userId, email, sessionId, role: claimRole } = input.verifiedPayload;
    if (!session.isOwnedBy(UserId.reconstitute(userId)) || session.id.value !== sessionId) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    const role = await this.#readCurrentRole(session, claimRole);
    const tokens = await this.#dependencies.tokenService.generateTokenPair(
      session.userId,
      email,
      session.id,
      role,
      session.tokenFamily,
      session.tokenVersion + 1,
    );
    const refreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(tokens.refreshToken);
    const refreshExpiresInSeconds =
      this.#dependencies.tokenService.getRefreshTokenExpiresInSeconds();
    const rotation = session.planRotation(
      refreshTokenHash,
      now.add({ seconds: refreshExpiresInSeconds }),
    );
    const isRotated = await this.#dependencies.sessionRepository.rotateToken(
      session.id,
      rotation,
      now,
    );
    if (!isRotated) {
      this.#dependencies.logger.warn({
        event: AuthLogEvent.SESSION_ROTATION_CONFLICT,
        userId,
        sessionId,
      });
      throw new ApplicationException(ErrorCode.SESSION_0702, { sessionId: undefined });
    }

    await this.#dependencies.cacheService.invalidateSession(session.id);
    await this.#dependencies.securityLogRepository.create({
      userId: session.userId,
      event: SECURITY_EVENT.TOKEN_REFRESH,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      ...(retryWithinGracePeriod && { metadata: { retryWithinGracePeriod: true } }),
    });
    this.#dependencies.logger.debug({
      event: AuthLogEvent.SESSION_TOKENS_REFRESHED,
      userId,
      sessionId,
      retryWithinGracePeriod,
    });
    return { tokens, sessionId };
  }

  // 강등된 ADMIN이 갱신으로 남지 않게 DB 역할로 발급한다. 못 읽으면 로그인을 끊지 않으려고 claim 역할을 쓴다
  async #readCurrentRole(session: AuthSession, claimRole: UserRole): Promise<UserRole> {
    const fallbackLog = {
      event: AuthLogEvent.SESSION_REFRESH_ROLE_FALLBACK,
      userId: session.userId.value,
      sessionId: session.id.value,
    };
    try {
      const user = await this.#dependencies.userRepository.findById(session.userId);
      if (user != null) {
        return user.role;
      }
      this.#dependencies.logger.warn({ ...fallbackLog, reason: "user-missing" });
    } catch (error) {
      this.#dependencies.logger.warn({
        ...fallbackLog,
        reason: "lookup-failed",
        errorType: toErrorType(error),
      });
    }
    return claimRole;
  }
}

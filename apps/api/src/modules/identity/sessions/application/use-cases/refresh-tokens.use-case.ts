import {
  REFRESH_TOKEN_REUSE_GRACE_MS,
  REVOKE_REASON,
  SECURITY_EVENT,
  type UserRole,
} from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import { SessionId } from "../../domain/session-id.vo.js";
import type { Session } from "../../domain/session.aggregate.js";
import type { SessionCachePort } from "../ports/session-cache.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type { SessionRepositoryPort } from "../ports/session.repository.port.js";
import type { TokenIssuerPort } from "../ports/token-issuer.port.js";
import type {
  RefreshedTokensReadModel,
  VerifiedRefreshPayload,
} from "../read-models/login.read-model.js";
import { SessionAlerts } from "../sessions.alerts.js";
import {
  refreshTokenReused,
  sessionExpired,
  sessionNotFound,
  sessionRevoked,
} from "../sessions.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";

export interface RefreshTokensCommand {
  readonly refreshToken: string;
  readonly verifiedPayload: VerifiedRefreshPayload;
  readonly metadata?: RequestMetadata;
}

interface RefreshTokensDependencies {
  readonly sessionRepository: Pick<
    SessionRepositoryPort,
    "findByRefreshTokenHash" | "findById" | "save" | "revokeByTokenFamily"
  >;
  readonly tokenService: Pick<
    TokenIssuerPort,
    "hashRefreshToken" | "generateTokenPair" | "getRefreshTokenExpiresInSeconds"
  >;
  readonly userRepository: Pick<UserRepositoryPort, "findById">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<SessionCachePort, "invalidateSession" | "evictSession">;
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

  async execute(input: RefreshTokensCommand): Promise<RefreshedTokensReadModel> {
    const { sessionId } = input.verifiedPayload;
    if (!sessionId) {
      throw sessionNotFound();
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
      throw sessionNotFound();
    }

    if (
      authSession.isRetryWithin(
        refreshTokenHash,
        this.#dependencies.clock.now(),
        REFRESH_TOKEN_REUSE_GRACE_MS,
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
      ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: {
        reason: REVOKE_REASON.TOKEN_REUSE_DETECTED,
        tokenFamily: authSession.tokenFamily,
      },
    });
    this.#dependencies.logger.warn({
      event: SessionLogEvent.SESSION_TOKEN_REUSE_DETECTED,
      userId: authSession.userId.value,
      sessionId,
      revokedCount: revokedSessionIds.length,
    });
    // 유출 의심 신호다. 사용자 ID는 로그에만 두고 경보에는 끊은 세션 수만 싣는다
    this.#dependencies.alert.raise({
      ...SessionAlerts.REFRESH_TOKEN_REUSED,
      details: { revokedCount: revokedSessionIds.length },
    });
    throw refreshTokenReused();
  }

  async #rotateSession(
    session: Session,
    input: RefreshTokensCommand,
    retryWithinGracePeriod: boolean,
  ): Promise<RefreshedTokensReadModel> {
    const now = this.#dependencies.clock.now();
    const validity = session.validityAt(now);
    if (validity === "revoked") {
      throw sessionRevoked();
    }
    if (validity === "expired") {
      throw sessionExpired();
    }

    const { userId, email, sessionId, role: claimRole } = input.verifiedPayload;
    if (!session.isOwnedBy(UserId.reconstitute(userId)) || session.id.value !== sessionId) {
      throw sessionNotFound();
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
    session.rotate({
      refreshTokenHash,
      expiresAt: now.add({ seconds: refreshExpiresInSeconds }),
      now,
    });
    const isRotated = await this.#dependencies.sessionRepository.save(session);
    if (!isRotated) {
      this.#dependencies.logger.warn({
        event: SessionLogEvent.SESSION_ROTATION_CONFLICT,
        userId,
        sessionId,
      });
      throw sessionExpired();
    }

    await this.#dependencies.cacheService.evictSession(session.id);
    await this.#dependencies.securityLogRepository.create({
      userId: session.userId,
      event: SECURITY_EVENT.TOKEN_REFRESH,
      ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
      ...(retryWithinGracePeriod && { metadata: { retryWithinGracePeriod: true } }),
    });
    this.#dependencies.logger.debug({
      event: SessionLogEvent.SESSION_TOKENS_REFRESHED,
      userId,
      sessionId,
      retryWithinGracePeriod,
    });
    return { tokens, sessionId };
  }

  // 강등된 ADMIN이 갱신으로 남지 않게 DB 역할로 발급한다. 못 읽으면 로그인을 끊지 않으려고 claim 역할을 쓴다
  async #readCurrentRole(session: Session, claimRole: UserRole): Promise<UserRole> {
    const fallbackLog = {
      event: SessionLogEvent.SESSION_REFRESH_ROLE_FALLBACK,
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

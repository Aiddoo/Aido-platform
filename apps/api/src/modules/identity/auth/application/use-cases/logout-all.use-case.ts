import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";

export interface LogoutAllCommand {
  readonly userId: string;
  readonly metadata?: RequestMetadata;
}

interface LogoutAllDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "revokeAllByUserId">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class LogoutAllUseCase {
  readonly #dependencies: LogoutAllDependencies;

  constructor(dependencies: LogoutAllDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LogoutAllCommand): Promise<{ message: string; revokedCount: number }> {
    const userId = UserId.reconstitute(input.userId);
    const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId({
      userId,
      reason: REVOKE_REASON.USER_LOGOUT_ALL,
      now: this.#dependencies.clock.now(),
    });
    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.#dependencies.cacheService.invalidateSession(sessionId),
      ),
    );
    await this.#dependencies.pushDevices.releaseSessions(revokedSessionIds);
    const revokedCount = revokedSessionIds.length;
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.SESSION_REVOKED_ALL,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: { revokedCount },
    });
    this.#dependencies.logger.log({
      event: AuthLogEvent.ALL_SESSIONS_LOGGED_OUT,
      userId: input.userId,
      revokedCount,
    });
    return { message: "모든 기기에서 로그아웃되었습니다.", revokedCount };
  }
}

import { REVOKE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { SessionPushDeviceReleaserPort } from "#api/modules/notification/push-devices/notification-push-devices.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { SessionCachePort } from "../ports/session-cache.port.js";
import type { SessionRepositoryPort } from "../ports/session.repository.port.js";
import { SessionLogEvent } from "../sessions.log-events.js";

export interface LogoutAllCommand {
  readonly userId: string;
  readonly metadata?: RequestMetadata;
}

interface LogoutAllDependencies {
  readonly sessionRepository: Pick<SessionRepositoryPort, "revokeAllByUserId">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<SessionCachePort, "invalidateSession">;
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
      ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: { revokedCount },
    });
    this.#dependencies.logger.log({
      event: SessionLogEvent.ALL_SESSIONS_LOGGED_OUT,
      userId: input.userId,
      revokedCount,
    });
    return { message: "모든 기기에서 로그아웃되었습니다.", revokedCount };
  }
}

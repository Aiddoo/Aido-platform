import { REVOKE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import { SessionId } from "../../domain/session-id.vo.js";
import type { SessionCachePort } from "../ports/session-cache.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type { SessionRepositoryPort } from "../ports/session.repository.port.js";
import { sessionNotFound } from "../sessions.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";

export interface RevokeSessionCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly metadata?: RequestMetadata;
}

interface RevokeSessionDependencies {
  readonly sessionRepository: Pick<SessionRepositoryPort, "findById" | "save">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<SessionCachePort, "invalidateSession">;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class RevokeSessionUseCase {
  readonly #dependencies: RevokeSessionDependencies;

  constructor(dependencies: RevokeSessionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RevokeSessionCommand): Promise<{ message: string }> {
    const userId = UserId.reconstitute(input.userId);
    const sessionId = SessionId.reconstitute(input.sessionId);
    const authSession = await this.#dependencies.sessionRepository.findById(sessionId);
    if (authSession == null || !authSession.isOwnedBy(userId)) {
      throw sessionNotFound();
    }

    // 이미 끊긴 세션은 처음 폐기 시각을 두고 같은 응답을 준다
    const revoked = authSession.revoke(REVOKE_REASON.USER_REVOKE, this.#dependencies.clock.now());
    if (!revoked || !(await this.#dependencies.sessionRepository.save(authSession))) {
      return { message: "세션이 종료되었습니다." };
    }
    await this.#dependencies.cacheService.invalidateSession(sessionId);
    await this.#dependencies.pushDevices.releaseSessions([sessionId]);
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.SESSION_REVOKED,
      ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: { revokedSessionId: input.sessionId },
    });
    this.#dependencies.logger.log({
      event: SessionLogEvent.SESSION_REVOKED,
      userId: input.userId,
      sessionId: input.sessionId,
    });
    return { message: "세션이 종료되었습니다." };
  }
}

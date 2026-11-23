import { REVOKE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { SessionPushDeviceReleaserPort } from "#api/modules/notification/push-devices/notification-push-devices.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import { SessionId } from "../../domain/session-id.vo.js";
import type { SessionCachePort } from "../ports/session-cache.port.js";
import type { SessionRepositoryPort } from "../ports/session.repository.port.js";
import { sessionExpired, sessionNotFound } from "../sessions.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";

export interface LogoutCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly metadata?: RequestMetadata;
}

interface LogoutDependencies {
  readonly sessionRepository: Pick<SessionRepositoryPort, "findById" | "save">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<SessionCachePort, "invalidateSession">;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class LogoutUseCase {
  readonly #dependencies: LogoutDependencies;

  constructor(dependencies: LogoutDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LogoutCommand): Promise<{ message: string }> {
    const userId = UserId.reconstitute(input.userId);
    const sessionId = SessionId.reconstitute(input.sessionId);
    const authSession = await this.#dependencies.sessionRepository.findById(sessionId);
    if (authSession == null || !authSession.isOwnedBy(userId)) {
      throw sessionNotFound();
    }

    // 이미 폐기됐거나 그 사이 다른 요청이 폐기했으면 출시 앱이 아는 만료 응답이다
    const revoked = authSession.revoke(REVOKE_REASON.USER_LOGOUT, this.#dependencies.clock.now());
    if (!revoked || !(await this.#dependencies.sessionRepository.save(authSession))) {
      throw sessionExpired();
    }
    await this.#dependencies.cacheService.invalidateSession(sessionId);
    await this.#dependencies.pushDevices.releaseSessions([sessionId]);
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.LOGOUT,
      ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
    });
    this.#dependencies.logger.log({
      event: SessionLogEvent.SESSION_LOGGED_OUT,
      userId: input.userId,
      sessionId: input.sessionId,
    });
    return { message: "로그아웃되었습니다." };
  }
}

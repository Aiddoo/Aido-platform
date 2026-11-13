import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import { SessionId } from "../../domain/session-id.vo.js";
import { sessionExpired, sessionNotFound } from "../auth.errors.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";

export interface LogoutCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly metadata?: RequestMetadata;
}

interface LogoutDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "findById" | "revoke">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
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

    if (authSession.isRevoked()) {
      throw sessionExpired();
    }

    await this.#dependencies.sessionRepository.revoke(
      sessionId,
      REVOKE_REASON.USER_LOGOUT,
      this.#dependencies.clock.now(),
    );
    await this.#dependencies.cacheService.invalidateSession(sessionId);
    await this.#dependencies.pushDevices.releaseSessions([sessionId]);
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.LOGOUT,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
    });
    this.#dependencies.logger.log({
      event: AuthLogEvent.SESSION_LOGGED_OUT,
      userId: input.userId,
      sessionId: input.sessionId,
    });
    return { message: "로그아웃되었습니다." };
  }
}

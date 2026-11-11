import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import { SessionId } from "../../domain/session-id.vo.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";

export interface RevokeSessionCommand {
  readonly userId: string;
  readonly sessionId: string;
  readonly metadata?: RequestMetadata;
}

interface RevokeSessionDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "findById" | "revoke">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
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
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    await this.#dependencies.sessionRepository.revoke(
      sessionId,
      REVOKE_REASON.USER_REVOKE,
      this.#dependencies.clock.now(),
    );
    await this.#dependencies.cacheService.invalidateSession(sessionId);
    await this.#dependencies.pushDevices.releaseSessions([sessionId]);
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.SESSION_REVOKED,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: { revokedSessionId: input.sessionId },
    });
    this.#dependencies.logger.log({
      event: AuthLogEvent.SESSION_REVOKED,
      userId: input.userId,
      sessionId: input.sessionId,
    });
    return { message: "세션이 종료되었습니다." };
  }
}

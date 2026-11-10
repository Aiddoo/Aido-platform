import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { AuthSession } from "../../domain/auth-session.aggregate.js";
import { AUTH_DEFAULTS, REVOKE_REASON, SECURITY_EVENT } from "../../domain/auth.constants.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type {
  AuthSecurityLogRepositoryPort,
  AuthSessionRepositoryPort,
} from "../ports/auth-persistence.port.js";
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
  readonly logger: ApplicationLoggerPort;
}

export class RevokeSessionUseCase {
  readonly #dependencies: RevokeSessionDependencies;

  constructor(dependencies: RevokeSessionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RevokeSessionCommand): Promise<{ message: string }> {
    const session = await this.#dependencies.sessionRepository.findById(input.sessionId);
    if (session == null) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }
    const authSession = AuthSession.reconstitute(session);
    if (!authSession.isOwnedBy(input.userId)) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    await this.#dependencies.sessionRepository.revoke(input.sessionId, REVOKE_REASON.USER_REVOKE);
    await this.#dependencies.cacheService.invalidateSession(input.sessionId);
    await this.#dependencies.pushDevices.releaseSessions([input.sessionId]);
    await this.#dependencies.securityLogRepository.create({
      userId: input.userId,
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

import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { AuthSession } from "../../../domain/aggregates/auth/auth-session.aggregate.js";
import {
  AUTH_DEFAULTS,
  REVOKE_REASON,
  SECURITY_EVENT,
} from "../../../domain/constants/auth/auth.constants.js";
import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type {
  AuthSecurityLogRepositoryPort,
  AuthSessionRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { RequestMetadata } from "../../types/auth/index.js";

export interface RevokeSessionInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly metadata?: RequestMetadata;
}

interface RevokeSessionDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "findById" | "revoke">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly logger: ApplicationLogger;
}

export class RevokeSession {
  readonly #dependencies: RevokeSessionDependencies;

  constructor(dependencies: RevokeSessionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RevokeSessionInput): Promise<{ message: string }> {
    const session = await this.#dependencies.sessionRepository.findById(input.sessionId);
    if (session === null) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }
    const authSession = AuthSession.reconstitute(session);
    if (!authSession.isOwnedBy(input.userId)) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId: undefined });
    }

    await this.#dependencies.sessionRepository.revoke(input.sessionId, REVOKE_REASON.USER_REVOKE);
    await this.#dependencies.cacheService.invalidateSession(input.sessionId);
    await this.#dependencies.securityLogRepository.create({
      userId: input.userId,
      event: SECURITY_EVENT.SESSION_REVOKED,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: { revokedSessionId: input.sessionId },
    });
    this.#dependencies.logger.log({
      event: IdentityLogEvent.SESSION_REVOKED,
      userId: input.userId,
      sessionId: input.sessionId,
    });
    return { message: "세션이 종료되었습니다." };
  }
}

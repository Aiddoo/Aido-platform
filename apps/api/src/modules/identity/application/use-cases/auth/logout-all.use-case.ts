import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

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

export interface LogoutAllInput {
  readonly userId: string;
  readonly metadata?: RequestMetadata;
}

interface LogoutAllDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "revokeAllByUserId">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly logger: ApplicationLogger;
}

export class LogoutAll {
  readonly #dependencies: LogoutAllDependencies;

  constructor(dependencies: LogoutAllDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LogoutAllInput): Promise<{ message: string; revokedCount: number }> {
    const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId(
      input.userId,
      REVOKE_REASON.USER_LOGOUT_ALL,
    );
    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.#dependencies.cacheService.invalidateSession(sessionId),
      ),
    );
    const revokedCount = revokedSessionIds.length;
    await this.#dependencies.securityLogRepository.create({
      userId: input.userId,
      event: SECURITY_EVENT.SESSION_REVOKED_ALL,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: { revokedCount },
    });
    this.#dependencies.logger.log({
      event: IdentityLogEvent.ALL_SESSIONS_LOGGED_OUT,
      userId: input.userId,
      revokedCount,
    });
    return { message: "모든 기기에서 로그아웃되었습니다.", revokedCount };
  }
}

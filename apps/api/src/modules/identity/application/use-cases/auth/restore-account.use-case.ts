import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { IdentityUser } from "../../../domain/aggregates/auth/identity-user.aggregate.js";
import { AUTH_DEFAULTS, SECURITY_EVENT } from "../../../domain/constants/auth/auth.constants.js";
import type {
  AuthSecurityLogRepositoryPort,
  AuthUserRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { RequestMetadata } from "../../types/auth/index.js";

export interface RestoreAccountInput {
  readonly user: IdentityUser;
  readonly metadata?: RequestMetadata;
  readonly at: Date;
}

interface RestoreAccountDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "restore">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
}

export class RestoreAccount {
  readonly #dependencies: RestoreAccountDependencies;

  constructor(dependencies: RestoreAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RestoreAccountInput): Promise<void> {
    if (!input.user.requiresRestoration(input.at)) {
      return;
    }
    const deletedAt = input.user.deletedAt;
    input.user.restore(input.at);
    await this.#dependencies.userRepository.restore(input.user.id);
    await this.#dependencies.securityLogRepository.create({
      userId: input.user.id,
      event: SECURITY_EVENT.ACCOUNT_RESTORED,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: {
        deletedAt: toISOStringOrNull(deletedAt),
        restoredAt: toISOString(input.at),
      },
    });
  }
}

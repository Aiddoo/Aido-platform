import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { IdentityUser } from "../../../users/domain/identity-user.aggregate.js";
import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";

export interface RestoreAccountCommand {
  readonly user: IdentityUser;
  readonly metadata?: RequestMetadata;
  readonly at: Temporal.Instant;
}

interface RestoreAccountDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "saveAccountStatus">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
}

/** 탈퇴 유예 안의 계정이 다시 로그인하면 되살린다. 호출자가 연 UoW에 함께 커밋된다 */
export class RestoreAccountUseCase {
  readonly #dependencies: RestoreAccountDependencies;

  constructor(dependencies: RestoreAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RestoreAccountCommand): Promise<void> {
    const deletedAt = input.user.deletedAt;
    if (!input.user.restore(input.at)) {
      return;
    }
    await this.#dependencies.userRepository.saveAccountStatus(input.user);
    await this.#dependencies.securityLogRepository.create({
      userId: input.user.id,
      event: SECURITY_EVENT.ACCOUNT_RESTORED,
      ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: {
        deletedAt: deletedAt == null ? null : toIsoString(deletedAt),
        restoredAt: toIsoString(input.at),
      },
    });
  }
}

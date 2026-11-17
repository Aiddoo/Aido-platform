import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { User } from "../../domain/user.aggregate.js";
import type { SecurityLogRepositoryPort } from "../ports/security-log.repository.port.js";
import type { UserRepositoryPort } from "../ports/user.repository.port.js";

export interface RestoreAccountCommand {
  readonly user: User;
  readonly metadata?: RequestMetadata;
  readonly at: Temporal.Instant;
}

interface RestoreAccountDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "save">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
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
    await this.#dependencies.userRepository.save(input.user);
    await this.#dependencies.securityLogRepository.create({
      userId: input.user.id,
      event: SECURITY_EVENT.ACCOUNT_RESTORED,
      ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
      userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: {
        deletedAt: deletedAt == null ? null : toIsoString(deletedAt),
        restoredAt: toIsoString(input.at),
      },
    });
  }
}

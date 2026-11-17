import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { type AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserMutationLockPort } from "../../../users/application/ports/user-mutation-lock.port.js";
import type { UserProfileInvalidatorPort } from "../../../users/application/ports/user-profile-invalidator.port.js";
import { userNotFound } from "../../../users/application/users.errors.js";
import { linkedAccountNotFound } from "../linked-accounts.errors.js";
import { LinkedAccountsLogEvent } from "../linked-accounts.log-events.js";
import type { LinkedAccountsRepositoryPort } from "../ports/linked-accounts.repository.port.js";

export interface UnlinkOAuthAccountCommand {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly metadata?: RequestMetadata;
}

interface UnlinkOAuthAccountDependencies {
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly accountRepository: Pick<LinkedAccountsRepositoryPort, "findByUserId" | "save">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
  readonly logger: ApplicationLoggerPort;
}

export class UnlinkOAuthAccountUseCase {
  readonly #dependencies: UnlinkOAuthAccountDependencies;

  constructor(dependencies: UnlinkOAuthAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UnlinkOAuthAccountCommand): Promise<{ message: string }> {
    const { provider, metadata } = input;
    const userId = UserId.reconstitute(input.userId);
    await this.#dependencies.unitOfWork.run(async () => {
      if (!(await this.#dependencies.userMutationLock.lockById(userId))) {
        throw userNotFound(input.userId);
      }
      const accounts = await this.#dependencies.accountRepository.findByUserId(userId);
      if (accounts == null || !accounts.unlink(provider)) {
        throw linkedAccountNotFound();
      }
      if (!(await this.#dependencies.accountRepository.save(accounts))) {
        throw linkedAccountNotFound();
      }
      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.OAUTH_UNLINKED,
        ipAddress: metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider },
      });
    });
    await this.#dependencies.cacheService.invalidateUserProfile(userId);
    this.#dependencies.logger.log({
      event: LinkedAccountsLogEvent.OAUTH_ACCOUNT_UNLINKED,
      userId: input.userId,
      provider,
    });
    return { message: "계정 연결이 해제되었습니다." };
  }
}

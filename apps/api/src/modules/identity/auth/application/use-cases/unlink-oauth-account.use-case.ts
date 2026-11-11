import { SECURITY_EVENT } from "@aido/api/vocabulary";

import {
  AUTH_DEFAULTS,
  type AccountProvider,
} from "#api/modules/identity/auth/domain/auth.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";

export interface UnlinkOAuthAccountCommand {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly metadata?: RequestMetadata;
}

interface UnlinkOAuthAccountDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByIdForUpdate">;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findIdentityAccounts" | "deleteAccount"
  >;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
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
      await this.#dependencies.userRepository.findByIdForUpdate(userId);
      const accounts = await this.#dependencies.accountRepository.findIdentityAccounts(userId);
      accounts.unlink(provider);
      await this.#dependencies.accountRepository.deleteAccount(userId, provider);
      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.OAUTH_UNLINKED,
        ipAddress: metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider },
      });
    });
    await this.#dependencies.cacheService.invalidateUserProfile(userId);
    this.#dependencies.logger.log({
      event: AuthLogEvent.OAUTH_ACCOUNT_UNLINKED,
      userId: input.userId,
      provider,
    });
    return { message: "계정 연결이 해제되었습니다." };
  }
}

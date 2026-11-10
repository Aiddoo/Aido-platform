import { AUTH_DEFAULTS, SECURITY_EVENT } from "#api/modules/identity/auth/domain/auth.constants";
import { IdentityAccounts } from "#api/modules/identity/auth/domain/identity-accounts.aggregate";
import type { AccountProvider } from "#api/modules/identity/auth/domain/identity.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type {
  AuthAccountRepositoryPort,
  AuthSecurityLogRepositoryPort,
  AuthUserLockRepositoryPort,
} from "../ports/auth-persistence.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";

export interface UnlinkOAuthAccountCommand {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly metadata?: RequestMetadata;
}

interface UnlinkOAuthAccountDependencies {
  readonly userRepository: AuthUserLockRepositoryPort;
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findAllByUserId" | "deleteAccount">;
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
    const { userId, provider, metadata } = input;
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.findByIdForUpdate(userId);
      const accounts = await this.#dependencies.accountRepository.findAllByUserId(userId);
      IdentityAccounts.reconstitute({ userId, accounts }).unlink(provider);
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
      userId,
      provider,
    });
    return { message: "계정 연결이 해제되었습니다." };
  }
}

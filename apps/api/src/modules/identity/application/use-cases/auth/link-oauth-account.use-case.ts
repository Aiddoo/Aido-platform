import { ErrorCode } from "@aido/api/errors";
import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthUserLockRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type { OAuthIdentityProviderRegistry } from "../../ports/auth/oauth-identity-provider.port.js";
import type { LinkOAuthIdentity } from "../../services/auth/link-oauth-identity.service.js";
import type { RequestMetadata } from "../../types/auth/index.js";

export interface LinkOAuthAccountInput {
  readonly userId: string;
  readonly provider: (typeof OAUTH_PROVIDERS)[number];
  readonly idToken?: string;
  readonly accessToken?: string;
  readonly nonce?: string;
  readonly metadata?: RequestMetadata;
}

interface LinkOAuthAccountDependencies {
  readonly userRepository: AuthUserLockRepositoryPort;
  readonly registry: OAuthIdentityProviderRegistry;
  readonly linkOAuthIdentity: Pick<LinkOAuthIdentity, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly logger: ApplicationLogger;
}

export class LinkOAuthAccount {
  readonly #dependencies: LinkOAuthAccountDependencies;

  constructor(dependencies: LinkOAuthAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthAccountInput): Promise<{ message: string }> {
    const strategy = this.#dependencies.registry.get(input.provider);
    if (strategy === undefined) throw new ApplicationException(ErrorCode.USER_0602);
    const token = input.idToken ?? input.accessToken;
    if (token === undefined || token === "") throw new ApplicationException(ErrorCode.USER_0602);
    const profile = await strategy.verifyToken(token, input.nonce);
    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.findByIdForUpdate(input.userId);
      return this.#dependencies.linkOAuthIdentity.execute({
        userId: input.userId,
        provider: input.provider,
        providerAccountId: profile.id,
        metadata: input.metadata,
      });
    });
    if (result.linked) {
      await this.#dependencies.cacheService.invalidateUserProfile(input.userId);
      this.#dependencies.logger.log({
        event: IdentityLogEvent.OAUTH_ACCOUNT_LINKED,
        userId: input.userId,
        provider: input.provider,
      });
    }
    return { message: result.message };
  }
}

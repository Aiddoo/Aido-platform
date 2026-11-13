import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { invalidCredentials } from "../auth.errors.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { OAuthIdentityProviderRegistryPort } from "../ports/oauth-identity-provider.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";
import type { LinkOAuthIdentityUseCase } from "./link-oauth-identity.use-case.js";

export interface LinkOAuthAccountCommand {
  readonly userId: string;
  readonly provider: (typeof OAUTH_PROVIDERS)[number];
  readonly idToken?: string;
  readonly accessToken?: string;
  readonly nonce?: string;
  readonly metadata?: RequestMetadata;
}

interface LinkOAuthAccountDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByIdForUpdate">;
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "get">;
  readonly linkOAuthIdentity: Pick<LinkOAuthIdentityUseCase, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly logger: ApplicationLoggerPort;
}

export class LinkOAuthAccountUseCase {
  readonly #dependencies: LinkOAuthAccountDependencies;

  constructor(dependencies: LinkOAuthAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthAccountCommand): Promise<{ message: string }> {
    const userId = UserId.reconstitute(input.userId);
    const strategy = this.#dependencies.registry.get(input.provider);
    if (strategy == null) {
      throw invalidCredentials();
    }
    const token = input.idToken ?? input.accessToken;
    if (token == null || token === "") {
      throw invalidCredentials();
    }
    const profile = await strategy.verifyToken(token, input.nonce);
    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.findByIdForUpdate(userId);
      return this.#dependencies.linkOAuthIdentity.execute({
        userId: input.userId,
        provider: input.provider,
        providerAccountId: profile.id,
        metadata: input.metadata,
      });
    });
    if (result.linked) {
      await this.#dependencies.cacheService.invalidateUserProfile(userId);
      this.#dependencies.logger.log({
        event: AuthLogEvent.OAUTH_ACCOUNT_LINKED,
        userId: input.userId,
        provider: input.provider,
      });
    }
    return { message: result.message };
  }
}

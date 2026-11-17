import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { UserMutationLockPort } from "../../../users/application/ports/user-mutation-lock.port.js";
import type { UserProfileInvalidatorPort } from "../../../users/application/ports/user-profile-invalidator.port.js";
import { invalidCredentials, userNotFound } from "../../../users/application/users.errors.js";
import { LinkedAccountsLogEvent } from "../linked-accounts.log-events.js";
import type { OAuthIdentityProviderRegistryPort } from "../ports/oauth-identity-provider.port.js";
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
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "get">;
  readonly linkOAuthIdentity: Pick<LinkOAuthIdentityUseCase, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
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
      if (!(await this.#dependencies.userMutationLock.lockById(userId))) {
        throw userNotFound(input.userId);
      }
      return this.#dependencies.linkOAuthIdentity.execute({
        userId: input.userId,
        provider: input.provider,
        providerAccountId: profile.id.value,
        metadata: input.metadata,
      });
    });
    if (result.linked) {
      await this.#dependencies.cacheService.invalidateUserProfile(userId);
      this.#dependencies.logger.log({
        event: LinkedAccountsLogEvent.OAUTH_ACCOUNT_LINKED,
        userId: input.userId,
        provider: input.provider,
      });
    }
    return { message: result.message };
  }
}

import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { oauthAccountAlreadyLinked } from "#api/modules/identity/linked-accounts/application/linked-accounts.errors";
import { type AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { IdentityPersistenceConflict } from "#api/modules/identity/shared/domain/identity.errors";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import { type SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import { type LinkedAccountsRepositoryPort } from "../ports/linked-accounts.repository.port.js";

export interface LinkOAuthIdentityCommand {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly metadata?: RequestMetadata;
}

interface LinkOAuthIdentityDependencies {
  readonly accountRepository: Pick<
    LinkedAccountsRepositoryPort,
    "findByProviderAccountId" | "createOAuthAccount"
  >;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
}

export class LinkOAuthIdentityUseCase {
  readonly #dependencies: LinkOAuthIdentityDependencies;

  constructor(dependencies: LinkOAuthIdentityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthIdentityCommand): Promise<{ message: string; linked: boolean }> {
    const { provider, providerAccountId, metadata } = input;
    const userId = UserId.reconstitute(input.userId);
    const existingAccount = await this.#dependencies.accountRepository.findByProviderAccountId(
      provider,
      providerAccountId,
    );
    if (existingAccount != null) {
      if (existingAccount.userId !== input.userId) {
        throw oauthAccountAlreadyLinked(provider, providerAccountId);
      }
      return { message: "이미 연결된 계정입니다.", linked: false };
    }
    try {
      await this.#dependencies.accountRepository.createOAuthAccount({
        userId,
        provider,
        providerAccountId,
      });
      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.OAUTH_LINKED,
        ipAddress: metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider, providerAccountId },
      });
    } catch (error) {
      if (
        error instanceof IdentityPersistenceConflict &&
        error.kind === "OAUTH_ACCOUNT_ALREADY_LINKED"
      ) {
        throw oauthAccountAlreadyLinked(provider, providerAccountId);
      }
      throw error;
    }
    return { message: "계정이 연결되었습니다.", linked: true };
  }
}

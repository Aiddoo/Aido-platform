import { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";

export interface ListLinkedAccountsQuery {
  readonly userId: string;
}

export interface ListLinkedAccountsResult {
  accounts: Array<{
    provider: (typeof OAUTH_PROVIDERS)[number];
    linked: boolean;
    providerAccountId: string | null;
    linkedAt: Temporal.Instant | null;
  }>;
  canUnlink: boolean;
}

interface ListLinkedAccountsDependencies {
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findIdentityAccounts">;
}

export class ListLinkedAccountsUseCase {
  readonly #dependencies: ListLinkedAccountsDependencies;

  constructor(dependencies: ListLinkedAccountsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ListLinkedAccountsQuery): Promise<ListLinkedAccountsResult> {
    const identityAccounts = await this.#dependencies.accountRepository.findIdentityAccounts(
      UserId.reconstitute(input.userId),
    );
    const accountsByProvider = new Map(
      identityAccounts.accounts.map((account) => [account.provider, account]),
    );
    return {
      accounts: OAUTH_PROVIDERS.map((provider) => {
        const account = accountsByProvider.get(provider);
        return {
          provider,
          linked: account != null,
          providerAccountId: account?.providerAccountId ?? null,
          linkedAt: account?.createdAt ?? null,
        };
      }),
      canUnlink: identityAccounts.canUnlink,
    };
  }
}

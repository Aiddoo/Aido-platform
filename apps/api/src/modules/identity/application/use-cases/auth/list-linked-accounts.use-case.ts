import { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import { IdentityAccounts } from "#api/modules/identity/domain/aggregates/auth/identity-accounts.aggregate";

import type { AuthAccountRepositoryPort } from "../../ports/auth/auth-persistence.port.js";

export interface ListLinkedAccountsInput {
  readonly userId: string;
}

export interface ListLinkedAccountsResult {
  accounts: Array<{
    provider: (typeof OAUTH_PROVIDERS)[number];
    linked: boolean;
    providerAccountId: string | null;
    linkedAt: Date | null;
  }>;
  canUnlink: boolean;
}

interface ListLinkedAccountsDependencies {
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findAllByUserId">;
}

export class ListLinkedAccounts {
  readonly #dependencies: ListLinkedAccountsDependencies;

  constructor(dependencies: ListLinkedAccountsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ListLinkedAccountsInput): Promise<ListLinkedAccountsResult> {
    const accounts = await this.#dependencies.accountRepository.findAllByUserId(input.userId);
    const accountsByProvider = new Map(accounts.map((account) => [account.provider, account]));
    return {
      accounts: OAUTH_PROVIDERS.map((provider) => {
        const account = accountsByProvider.get(provider);
        return {
          provider,
          linked: account !== undefined,
          providerAccountId: account?.providerAccountId ?? null,
          linkedAt: account?.createdAt ?? null,
        };
      }),
      canUnlink: IdentityAccounts.reconstitute({ userId: input.userId, accounts }).canUnlink,
    };
  }
}

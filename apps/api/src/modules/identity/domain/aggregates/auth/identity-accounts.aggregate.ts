import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { AggregateRoot } from "#api/shared/domain/index";

import type { AccountProvider } from "../../types/auth/auth.types.js";

export interface IdentityAccountProps {
  id: number;
  provider: AccountProvider;
  providerAccountId: string;
}

export interface IdentityAccountsProps {
  userId: string;
  accounts: readonly IdentityAccountProps[];
}

export class IdentityAccounts extends AggregateRoot<IdentityAccountsProps> {
  static reconstitute(props: IdentityAccountsProps): IdentityAccounts {
    return new IdentityAccounts({
      userId: props.userId,
      accounts: props.accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
    });
  }

  get canUnlink(): boolean {
    return this.props.accounts.length > 1;
  }

  unlink(provider: AccountProvider): void {
    const account = this.props.accounts.find((candidate) => candidate.provider === provider);
    if (account === undefined) {
      throw new DomainException(ErrorCode.USER_0603, { provider: undefined });
    }
    if (!this.canUnlink) throw new DomainException(ErrorCode.USER_0610);
    this.props.accounts = this.props.accounts.filter((candidate) => candidate.id !== account.id);
  }
}

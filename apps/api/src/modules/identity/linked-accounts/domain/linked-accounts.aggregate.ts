import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { AccountProvider } from "./linked-accounts.constants.js";
import { lastLoginMethodRequired, linkedAccountNotFound } from "./linked-accounts.errors.js";

export interface LinkedAccountPrimitives {
  readonly id: number;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly createdAt: Temporal.Instant;
}

export interface LinkedAccountsPrimitives {
  readonly userId: string;
  readonly accounts: readonly LinkedAccountPrimitives[];
}

interface LinkedAccountsProps {
  accounts: readonly LinkedAccountPrimitives[];
}

/** 한 사용자의 로그인 수단(이메일·소셜) 묶음. 마지막 하나는 끊을 수 없다 */
export class LinkedAccounts extends AggregateRoot<UserId, LinkedAccountsProps> {
  static reconstitute(primitives: LinkedAccountsPrimitives): LinkedAccounts {
    return new LinkedAccounts(UserId.reconstitute(primitives.userId), {
      accounts: [...primitives.accounts],
    });
  }

  get accounts(): readonly LinkedAccountPrimitives[] {
    return this.props.accounts;
  }

  get canUnlink(): boolean {
    return this.props.accounts.length > 1;
  }

  unlink(provider: AccountProvider): LinkedAccountPrimitives {
    const account = this.props.accounts.find((candidate) => candidate.provider === provider);
    if (account == null) {
      throw linkedAccountNotFound();
    }
    if (!this.canUnlink) {
      throw lastLoginMethodRequired();
    }
    this.props.accounts = this.props.accounts.filter((candidate) => candidate.id !== account.id);
    return account;
  }

  toPrimitives(): LinkedAccountsPrimitives {
    return { userId: this.id.value, accounts: this.props.accounts };
  }
}

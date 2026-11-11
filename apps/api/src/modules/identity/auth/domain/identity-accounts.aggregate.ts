import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { AccountProvider } from "./auth.constants.js";

export interface IdentityAccountPrimitives {
  readonly id: number;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly createdAt: Temporal.Instant;
}

export interface IdentityAccountsPrimitives {
  readonly userId: string;
  readonly accounts: readonly IdentityAccountPrimitives[];
}

interface IdentityAccountsProps {
  accounts: readonly IdentityAccountPrimitives[];
}

/** 한 사용자의 로그인 수단(이메일·소셜) 묶음. 마지막 하나는 끊을 수 없다 */
export class IdentityAccounts extends AggregateRoot<UserId, IdentityAccountsProps> {
  static reconstitute(primitives: IdentityAccountsPrimitives): IdentityAccounts {
    return new IdentityAccounts(UserId.reconstitute(primitives.userId), {
      accounts: [...primitives.accounts],
    });
  }

  get accounts(): readonly IdentityAccountPrimitives[] {
    return this.props.accounts;
  }

  get canUnlink(): boolean {
    return this.props.accounts.length > 1;
  }

  unlink(provider: AccountProvider): IdentityAccountPrimitives {
    const account = this.props.accounts.find((candidate) => candidate.provider === provider);
    if (account == null) {
      throw new DomainException(ErrorCode.USER_0603, { provider: undefined });
    }
    if (!this.canUnlink) {
      throw new DomainException(ErrorCode.USER_0610);
    }
    this.props.accounts = this.props.accounts.filter((candidate) => candidate.id !== account.id);
    return account;
  }

  toPrimitives(): IdentityAccountsPrimitives {
    return { userId: this.id.value, accounts: this.props.accounts };
  }
}

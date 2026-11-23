import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { LinkedAccountId } from "./linked-account-id.vo.js";
import { LinkedAccount, type LinkedAccountPrimitives } from "./linked-account.entity.js";
import { LinkedAccountsId } from "./linked-accounts-id.vo.js";
import type { AccountProvider } from "./linked-accounts.constants.js";
import {
  lastLoginMethodRequired,
  oauthAccountAlreadyLinked,
  socialAccountPasswordUnchangeable,
} from "./linked-accounts.errors.js";

export interface LinkedAccountsPrimitives {
  readonly userId: string;
  readonly accounts: readonly LinkedAccountPrimitives[];
}

interface LinkedAccountsProps {
  readonly userId: UserId;
  accounts: readonly LinkedAccount[];
}

/** 한 사용자의 로그인 수단(이메일·소셜) 묶음. 공급자마다 하나이고 마지막 하나는 끊을 수 없다 */
export class LinkedAccounts extends AggregateRoot<LinkedAccountsId, LinkedAccountsProps> {
  // 가입하는 사용자는 로그인 수단 없이 시작해 link·setPassword로 첫 수단을 더한다
  static create(userId: UserId): LinkedAccounts {
    return new LinkedAccounts(LinkedAccountsId.reconstitute(userId.value), {
      userId,
      accounts: [],
    });
  }

  static reconstitute(primitives: LinkedAccountsPrimitives): LinkedAccounts {
    return new LinkedAccounts(LinkedAccountsId.reconstitute(primitives.userId), {
      userId: UserId.reconstitute(primitives.userId),
      accounts: primitives.accounts.map((account) => LinkedAccount.reconstitute(account)),
    });
  }

  #unlinkedAccounts: readonly LinkedAccount[] = [];

  get userId(): UserId {
    return this.props.userId;
  }

  get accounts(): readonly LinkedAccount[] {
    return this.props.accounts;
  }

  get passwordHash(): string | null {
    return this.#findByProvider("CREDENTIAL")?.passwordHash ?? null;
  }

  canUnlink(): boolean {
    return this.props.accounts.length > 1;
  }

  hasCredentialAccount(): boolean {
    return this.#findByProvider("CREDENTIAL") != null;
  }

  hasPassword(): boolean {
    const passwordHash = this.passwordHash;
    return passwordHash != null && passwordHash !== "";
  }

  // 같은 공급자 계정이 이미 이 사용자에게 있으면 false, 같은 공급자의 다른 계정이 있으면 금지다
  link(params: {
    readonly id: LinkedAccountId;
    readonly provider: AccountProvider;
    readonly providerAccountId: string;
    readonly now: Temporal.Instant;
  }): boolean {
    const current = this.#findByProvider(params.provider);
    if (current != null) {
      if (current.providerAccountId === params.providerAccountId) {
        return false;
      }
      throw oauthAccountAlreadyLinked(params.provider, params.providerAccountId);
    }
    this.props.accounts = [
      ...this.props.accounts,
      LinkedAccount.create({ ...params, passwordHash: null }),
    ];
    return true;
  }

  // 연결하지 않은 공급자면 false다. 남은 수단이 하나뿐이면 금지다
  unlink(provider: AccountProvider): boolean {
    const account = this.#findByProvider(provider);
    if (account == null) {
      return false;
    }
    if (!this.canUnlink()) {
      throw lastLoginMethodRequired();
    }
    this.props.accounts = this.props.accounts.filter((candidate) => candidate !== account);
    if (account.isPersisted()) {
      this.#unlinkedAccounts = [...this.#unlinkedAccounts, account];
    }
    return true;
  }

  // 이메일 로그인 수단이 이미 있으면 false다
  setPassword(params: {
    readonly id: LinkedAccountId;
    readonly passwordHash: string;
    readonly now: Temporal.Instant;
  }): boolean {
    if (this.hasCredentialAccount()) {
      return false;
    }
    this.props.accounts = [
      ...this.props.accounts,
      LinkedAccount.create({
        ...params,
        provider: "CREDENTIAL",
        // 이메일 계정은 공급자 계정 id가 없어 사용자 id로 유일 제약을 채운다
        providerAccountId: this.props.userId.value,
      }),
    ];
    return true;
  }

  changePassword(passwordHash: string, now: Temporal.Instant): boolean {
    const credential = this.#findByProvider("CREDENTIAL");
    if (credential == null) {
      throw socialAccountPasswordUnchangeable(this.props.userId.value);
    }
    return credential.changePassword(passwordHash, now);
  }

  linkedSinceLoad(): readonly LinkedAccount[] {
    return this.props.accounts.filter((account) => !account.isPersisted());
  }

  unlinkedSinceLoad(): readonly LinkedAccount[] {
    return this.#unlinkedAccounts;
  }

  passwordChangedSinceLoad(): LinkedAccount | null {
    return this.props.accounts.find((account) => account.hasPasswordChangedSinceLoad()) ?? null;
  }

  toPrimitives(): LinkedAccountsPrimitives {
    return {
      userId: this.props.userId.value,
      accounts: this.props.accounts.map((account) => account.toPrimitives()),
    };
  }

  #findByProvider(provider: AccountProvider): LinkedAccount | null {
    return this.props.accounts.find((account) => account.provider === provider) ?? null;
  }
}

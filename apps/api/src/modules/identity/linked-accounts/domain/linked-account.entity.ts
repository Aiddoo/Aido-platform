import { Entity } from "#api/shared/domain/model/entity";

import { LinkedAccountId } from "./linked-account-id.vo.js";
import type { AccountProvider } from "./linked-accounts.constants.js";

export interface LinkedAccountPrimitives {
  readonly id: number;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly passwordHash: string | null;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface LinkedAccountProps {
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  passwordHash: string | null;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

/** 로그인 수단 하나(`Account` 행). LinkedAccounts를 거쳐서만 바뀐다 */
export class LinkedAccount extends Entity<LinkedAccountId, LinkedAccountProps> {
  static create(params: {
    readonly id: LinkedAccountId;
    readonly provider: AccountProvider;
    readonly providerAccountId: string;
    readonly passwordHash: string | null;
    readonly now: Temporal.Instant;
  }): LinkedAccount {
    return new LinkedAccount(params.id, {
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      passwordHash: params.passwordHash,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: LinkedAccountPrimitives): LinkedAccount {
    const { id, ...props } = primitives;
    const account = new LinkedAccount(LinkedAccountId.reconstitute(id), props);
    account.#persisted = { passwordHash: primitives.passwordHash };
    return account;
  }

  // 저장소가 경합을 막는 기준이다. 새 계정은 null이고 읽은 계정은 읽을 때의 비밀번호 hash를 둔다
  #persisted: { readonly passwordHash: string | null } | null = null;

  get provider(): AccountProvider {
    return this.props.provider;
  }

  get providerAccountId(): string {
    return this.props.providerAccountId;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get persistedPasswordHash(): string | null {
    return this.#persisted?.passwordHash ?? null;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get updatedAt(): Temporal.Instant {
    return this.props.updatedAt;
  }

  isPersisted(): boolean {
    return this.#persisted != null;
  }

  hasPasswordChangedSinceLoad(): boolean {
    return this.#persisted != null && this.#persisted.passwordHash !== this.props.passwordHash;
  }

  changePassword(passwordHash: string, now: Temporal.Instant): boolean {
    if (this.props.passwordHash === passwordHash) {
      return false;
    }
    this.props.passwordHash = passwordHash;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): LinkedAccountPrimitives {
    return { id: this.id.value, ...this.props };
  }
}

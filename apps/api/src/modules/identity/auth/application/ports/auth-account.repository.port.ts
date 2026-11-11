import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider } from "../../domain/auth.constants.js";
import type { IdentityAccounts } from "../../domain/identity-accounts.aggregate.js";

export interface AuthAccountRecord {
  readonly id: number;
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly password: string | null;
  readonly createdAt: Temporal.Instant;
}

export interface NewOAuthAccount {
  readonly userId: UserId;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly refreshToken?: string;
}

export abstract class AuthAccountRepositoryPort {
  abstract findByUserIdAndProvider(
    userId: UserId,
    provider: AccountProvider,
  ): Promise<AuthAccountRecord | null>;
  abstract findByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<AuthAccountRecord | null>;
  abstract findAllByUserId(userId: UserId): Promise<AuthAccountRecord[]>;
  abstract findIdentityAccounts(userId: UserId): Promise<IdentityAccounts>;
  /** 같은 사용자에게 이메일 계정이 이미 있으면 USER_0604로 거절한다 */
  abstract createCredentialAccount(userId: UserId, hashedPassword: string): Promise<void>;
  abstract updatePassword(userId: UserId, hashedPassword: string): Promise<void>;
  /** 저장된 hash가 기대한 값일 때만 바꾼다. 그 사이 바뀌었으면 false다 */
  abstract updatePasswordIfUnchanged(
    userId: UserId,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean>;
  /** 같은 공급자 계정이 이미 연결돼 있으면 AuthPersistenceConflict(OAUTH_ACCOUNT_ALREADY_LINKED)다 */
  abstract createOAuthAccount(account: NewOAuthAccount): Promise<void>;
  abstract deleteAccount(userId: UserId, provider: AccountProvider): Promise<void>;
}

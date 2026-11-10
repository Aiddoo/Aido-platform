import type { AccountProvider } from "../../domain/auth.constants.js";
import type { IdentityAccounts } from "../../domain/identity-accounts.aggregate.js";

export interface AuthAccountRecord {
  id: number;
  userId: string;
  provider: AccountProvider;
  providerAccountId: string;
  password: string | null;
  createdAt: Date;
}

export abstract class AuthAccountRepositoryPort {
  abstract findByUserIdAndProvider(
    userId: string,
    provider: AccountProvider,
  ): Promise<AuthAccountRecord | null>;
  abstract findByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<AuthAccountRecord | null>;
  abstract findAllByUserId(userId: string): Promise<AuthAccountRecord[]>;
  abstract findIdentityAccounts(userId: string): Promise<IdentityAccounts>;
  abstract createCredentialAccount(userId: string, hashedPassword: string): Promise<unknown>;
  abstract updatePassword(userId: string, hashedPassword: string): Promise<unknown>;
  abstract updatePasswordIfUnchanged(
    userId: string,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean>;
  abstract createOAuthAccount(data: {
    userId: string;
    provider: AccountProvider;
    providerAccountId: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: Date;
    scope?: string;
  }): Promise<unknown>;
  abstract deleteAccount(userId: string, provider: AccountProvider): Promise<unknown>;
}

import type { SubscriptionStatus, UserRole } from "@aido/api/vocabulary";

import type { AuthOAuthState } from "../../domain/auth-oauth-state.aggregate.js";
import type { AuthSession, AuthSessionRotation } from "../../domain/auth-session.aggregate.js";
import type { AuthVerification } from "../../domain/auth-verification.aggregate.js";
import type {
  AccountProvider,
  DeviceFingerprint,
  UserStatus,
  VerificationType,
} from "../../domain/auth.constants.js";
import type { IdentityAccounts } from "../../domain/identity-accounts.aggregate.js";
import type { IdentityUser } from "../../domain/identity-user.aggregate.js";
import type { OAuthMode } from "./oauth-identity-provider.port.js";

export interface AuthUserRecord {
  id: string;
  email: string;
  userTag: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface AuthUserProfileRecord extends AuthUserRecord {
  profile: { name: string | null; profileImage: string | null } | null;
  accounts: Array<{ provider: AccountProvider }>;
}

export abstract class AuthUserRepositoryPort {
  abstract findByEmail(email: string): Promise<IdentityUser | null>;
  abstract findById(id: string): Promise<IdentityUser | null>;
  abstract findByIdWithProfile(id: string): Promise<AuthUserProfileRecord | null>;
  abstract create(data: {
    email: string;
    status: UserStatus;
    emailVerifiedAt?: Date;
  }): Promise<IdentityUser>;
  abstract createProfile(
    userId: string,
    data: { name?: string; profileImage?: string },
  ): Promise<void>;
  abstract markEmailVerified(id: string): Promise<unknown>;
  abstract updateProfile(
    userId: string,
    data: { name?: string | null; profileImage?: string | null },
  ): Promise<{ name: string | null; profileImage: string | null }>;
  /** 탈퇴 요청·복구로 바뀐 상태(status·deletedAt)만 저장한다 */
  abstract saveAccountStatus(user: IdentityUser): Promise<void>;
  /** 계정 변경을 직렬화하려고 사용자 행을 잠그고 읽는다(FOR NO KEY UPDATE) */
  abstract findByIdForUpdate(id: string): Promise<IdentityUser | null>;
  /** 탈퇴 유예가 지난 사용자 */
  abstract listPurgeEligible(now: Temporal.Instant): Promise<IdentityUser[]>;
  abstract hardDelete(id: string): Promise<void>;
}

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

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  previousTokenHash: string | null;
  tokenFamily: string;
  tokenVersion: number;
  ipAddress: string;
  userAgent: string;
  lastUsedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface NewAuthSession {
  readonly userId: string;
  readonly tokenFamily: string;
  readonly tokenVersion: number;
  readonly deviceFingerprint: DeviceFingerprint;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly expiresAt: Temporal.Instant;
}

export abstract class AuthSessionRepositoryPort {
  abstract create(data: NewAuthSession): Promise<AuthSessionRecord>;
  abstract updateRefreshTokenHash(id: string, refreshTokenHash: string): Promise<unknown>;
  abstract findById(id: string): Promise<AuthSession | null>;
  abstract findByRefreshTokenHash(hash: string): Promise<AuthSession | null>;
  abstract findActiveByUserId(userId: string): Promise<AuthSessionRecord[]>;
  /** 버전이 그대로이고 폐기되지 않았을 때만 바꾼다. 경합에 지면 false다 */
  abstract rotateToken(
    id: string,
    rotation: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean>;
  abstract revoke(id: string, reason: string): Promise<unknown>;
  abstract revokeByTokenFamily(tokenFamily: string, reason: string): Promise<readonly string[]>;
  abstract revokeAllByUserId(
    userId: string,
    reason: string,
    excludeSessionId?: string,
  ): Promise<readonly string[]>;
}

export interface ConsumeAuthVerificationInput {
  id: number;
  userId: string;
  type: VerificationType;
  tokenHash: string;
  maxAttempts: number;
  at: Temporal.Instant;
}

export abstract class AuthVerificationRepositoryPort {
  abstract create(data: {
    userId: string;
    type: VerificationType;
    token: string;
    expiresAt: Date;
  }): Promise<unknown>;
  abstract findValidByUserIdAndType(
    userId: string,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<AuthVerification | null>;
  abstract consume(input: ConsumeAuthVerificationInput): Promise<boolean>;
  abstract incrementAttempts(id: number): Promise<unknown>;
  abstract invalidateAllByUserIdAndType(userId: string, type: VerificationType): Promise<number>;
  abstract countRecentByUserIdAndType(
    userId: string,
    type: VerificationType,
    since: Date,
  ): Promise<number>;
}

export abstract class AuthLoginAttemptRepositoryPort {
  abstract create(data: {
    email: string;
    provider?: AccountProvider;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
  }): Promise<unknown>;
  abstract countRecentFailuresByEmail(email: string, since: Date): Promise<number>;
}

export abstract class AuthSecurityLogRepositoryPort {
  abstract create(data: {
    userId?: string;
    event: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface AuthOAuthStateRecord {
  id: number;
  state: string;
  provider: AccountProvider;
  redirectUri: string;
  mode: string | null;
  initiatingUserId: string | null;
  exchangeCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userName: string | null;
  profileImage: string | null;
  accountRestored: boolean | null;
  isNewUser: boolean | null;
  expiresAt: Date;
  exchangedAt: Date | null;
}

export type ConsumeAuthOAuthStateInput = {
  id: number;
  exchangeCode: string;
  at: Temporal.Instant;
} & ({ purpose: "login" } | { purpose: "link"; actorUserId: string });

export abstract class AuthOAuthStateRepositoryPort {
  abstract create(
    state: string,
    provider: AccountProvider,
    redirectUri: string,
    options?: {
      mode?: OAuthMode;
      codeVerifier?: string;
      ipAddress?: string;
      userAgent?: string;
      expiresInMinutes?: number;
      initiatingUserId?: string;
    },
  ): Promise<AuthOAuthStateRecord>;
  abstract findByState(state: string): Promise<AuthOAuthStateRecord | null>;
  abstract findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<AuthOAuthState | null>;
  abstract saveExchangeData(
    id: number,
    data: {
      exchangeCode: string;
      accessToken: string;
      refreshToken: string;
      userId: string;
      userName?: string;
      profileImage?: string;
      accountRestored?: boolean;
      isNewUser: boolean;
    },
  ): Promise<unknown>;
  abstract saveLinkingData(
    id: number,
    data: {
      exchangeCode: string;
      provider: AccountProvider;
      providerAccountId: string;
    },
  ): Promise<unknown>;
  abstract consumeExchangeCode(input: ConsumeAuthOAuthStateInput): Promise<boolean>;
  abstract generateExchangeCode(): string;
}

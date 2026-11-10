import type { SubscriptionStatus, UserRole } from "@aido/api/vocabulary";

import type { AccountProvider, UserStatus } from "../../domain/auth.constants.js";
import type { IdentityUser } from "../../domain/identity-user.aggregate.js";

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

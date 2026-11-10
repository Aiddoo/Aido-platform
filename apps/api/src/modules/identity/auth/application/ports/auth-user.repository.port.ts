import type { SubscriptionStatus, UserRole } from "@aido/api/vocabulary";

import type { IdentityUser } from "../../../users/domain/identity-user.aggregate.js";
import type { AccountProvider, UserStatus } from "../../domain/auth.constants.js";

interface AuthUserRecord {
  id: string;
  email: string;
  userTag: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Temporal.Instant | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Temporal.Instant | null;
  createdAt: Temporal.Instant;
  deletedAt: Temporal.Instant | null;
}

export interface AuthUserProfileRecord extends AuthUserRecord {
  profile: { name: string | null; profileImage: string | null } | null;
  accounts: Array<{ provider: AccountProvider }>;
}

export abstract class AuthUserRepositoryPort {
  abstract findByEmail(email: string): Promise<IdentityUser | null>;
  abstract findById(id: string): Promise<IdentityUser | null>;
  abstract findByIdWithProfile(id: string): Promise<AuthUserProfileRecord | null>;
  /** 이메일이 이미 있으면 AuthPersistenceConflict(EMAIL_ALREADY_EXISTS)다 */
  abstract create(data: {
    readonly email: string;
    readonly status: UserStatus;
    readonly emailVerifiedAt?: Temporal.Instant;
  }): Promise<IdentityUser>;
  abstract createProfile(
    userId: string,
    data: { name?: string; profileImage?: string },
  ): Promise<void>;
  abstract markEmailVerified(id: string, now: Temporal.Instant): Promise<void>;
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

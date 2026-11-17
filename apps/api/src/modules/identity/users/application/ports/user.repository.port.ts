import type { SubscriptionStatus, UserRole } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";
import type { User } from "../../domain/user.aggregate.js";
import type { UserStatus } from "../../domain/users.constants.js";

interface UserRecord {
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

export interface UserProfileRecord extends UserRecord {
  profile: { name: string | null; profileImage: string | null } | null;
  accounts: Array<{ provider: AccountProvider }>;
}

export interface PurgeEligibleUsersQuery {
  readonly now: Temporal.Instant;
  /** id 순 커서. 지난 묶음의 마지막 사용자 id */
  readonly afterId: UserId | null;
  readonly limit: number;
}

export abstract class UserRepositoryPort {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: UserId): Promise<User | null>;
  abstract findByIdWithProfile(id: UserId): Promise<UserProfileRecord | null>;
  /** 이메일이 이미 있으면 IdentityPersistenceConflict(EMAIL_ALREADY_EXISTS)다 */
  abstract create(data: {
    readonly email: string;
    readonly status: UserStatus;
    readonly emailVerifiedAt?: Temporal.Instant;
  }): Promise<User>;
  abstract createProfile(
    userId: UserId,
    data: { name?: string; profileImage?: string },
  ): Promise<void>;
  abstract markEmailVerified(id: UserId, now: Temporal.Instant): Promise<void>;
  abstract updateProfile(
    userId: UserId,
    data: { name?: string | null; profileImage?: string | null },
  ): Promise<{ name: string | null; profileImage: string | null }>;
  /** 탈퇴 요청·복구로 바뀐 상태(status·deletedAt)만 저장한다 */
  abstract saveAccountStatus(user: User): Promise<void>;
  /** 계정 변경을 직렬화하려고 사용자 행을 잠그고 읽는다(FOR NO KEY UPDATE) */
  abstract findByIdForUpdate(id: UserId): Promise<User | null>;
  /** 탈퇴 유예가 지난 사용자를 id 순으로 limit명까지 */
  abstract listPurgeEligible(query: PurgeEligibleUsersQuery): Promise<User[]>;
  abstract hardDelete(id: UserId): Promise<void>;
}

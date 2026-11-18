import { ACCOUNT_DELETION, type SubscriptionStatus, type UserRole } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { isExpiredAt } from "../../shared/domain/expiry.domain-service.js";
import type { UserStatus } from "./users.constants.js";
import { accountDeleted } from "./users.errors.js";

export interface UserPrimitives {
  readonly id: string;
  readonly email: string;
  readonly userTag: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly emailVerifiedAt: Temporal.Instant | null;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly subscriptionExpiresAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly deletedAt: Temporal.Instant | null;
}

interface UserProps {
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

// 탈퇴 유예는 UTC 기준 일수다(UTC에는 일광 절약이 없어 24시간 단위와 같다)
const GRACE_PERIOD = Temporal.Duration.from({ hours: 24 * ACCOUNT_DELETION.GRACE_PERIOD_DAYS });

/** 로그인 가능 여부와 탈퇴·복구 상태를 가진 사용자 계정 */
export class User extends AggregateRoot<UserId, UserProps> {
  static reconstitute(primitives: UserPrimitives): User {
    const { id, ...props } = primitives;
    return new User(UserId.reconstitute(id), { ...props });
  }

  get email(): string {
    return this.props.email;
  }

  get userTag(): string {
    return this.props.userTag;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get emailVerifiedAt(): Temporal.Instant | null {
    return this.props.emailVerifiedAt;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  get deletedAt(): Temporal.Instant | null {
    return this.props.deletedAt;
  }

  isDeleted(): boolean {
    return this.props.deletedAt != null;
  }

  /** 탈퇴 대기 중이고 유예 안(유예 끝 시각 전)이면 true다. 유예가 끝났으면 복구할 수 없어 USER_0606이다 */
  requiresRestoration(now: Temporal.Instant): boolean {
    if (this.props.deletedAt == null) {
      return false;
    }
    if (!isExpiredAt(this.props.deletedAt.add(GRACE_PERIOD), now)) {
      return true;
    }
    throw accountDeleted(this.id.value);
  }

  // 메일 인증 전 가입만 ACTIVE로 바꾼다. 정지·잠금 상태는 인증 시각만 남기고 그대로 둔다
  markEmailVerified(now: Temporal.Instant): boolean {
    if (this.props.emailVerifiedAt != null) {
      return false;
    }
    this.props.emailVerifiedAt = now;
    if (this.props.status === "PENDING_VERIFY") {
      this.props.status = "ACTIVE";
    }
    return true;
  }

  requestDeletion(now: Temporal.Instant): void {
    if (this.props.deletedAt != null) {
      throw accountDeleted(this.id.value);
    }
    this.props.status = "SUSPENDED";
    this.props.deletedAt = now;
  }

  restore(now: Temporal.Instant): boolean {
    if (!this.requiresRestoration(now)) {
      return false;
    }
    this.props.status = "ACTIVE";
    this.props.deletedAt = null;
    return true;
  }

  isPurgeEligibleAt(now: Temporal.Instant): boolean {
    return this.props.deletedAt != null && isExpiredAt(this.props.deletedAt.add(GRACE_PERIOD), now);
  }

  toPrimitives(): UserPrimitives {
    return { id: this.id.value, ...this.props };
  }
}

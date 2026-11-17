import type { SubscriptionStatus } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface UserSubscriptionProjection {
  readonly subscriptionStatus: SubscriptionStatus;
  /** 생략하면 저장된 만료 시각을 그대로 두고, null이면 지운다. */
  readonly subscriptionExpiresAt?: Temporal.Instant | null;
}

export interface ListLapsedPremiumUsersParams {
  readonly now: Temporal.Instant;
  readonly afterUserId?: UserId;
  readonly limit: number;
}

/**
 * User 행의 구독 projection 칸(subscriptionStatus·subscriptionExpiresAt)을 읽고 쓰는 유일한 문이다. 출시 앱 /me와
 * 권한 SQL이 읽는 칸이라 User 행에 두고, billing이 사용자 잠금 안에서 부른다. 활성 트랜잭션에 함께 커밋된다.
 */
export abstract class UserSubscriptionProjectionPort {
  /** User가 없으면 던진다(DatabaseRecordNotFoundError). */
  abstract update(userId: UserId, projection: UserSubscriptionProjection): Promise<void>;
  /**
   * projection은 ACTIVE인데 access 판단으로는 프리미엄이 끝난 사용자를 userId 순으로 읽는다.
   * 만료 웹훅을 잃은 스토어 구독자가 대상이고, 다시 계산하면 조건에서 빠진다.
   */
  abstract listLapsedPremiumUserIds(params: ListLapsedPremiumUsersParams): Promise<UserId[]>;
}

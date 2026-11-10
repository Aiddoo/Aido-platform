import type { SubscriptionStatus } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** User 행에 남기는 구독 projection. 프리미엄 판단은 이 값이 아니라 스토어 구독과 보상 기간이 정한다. */
export interface UserSubscriptionProjection {
  readonly subscriptionStatus: SubscriptionStatus;
  readonly subscriptionExpiresAt?: Temporal.Instant | null;
}

export interface ListLapsedPremiumUsersParams {
  readonly now: Temporal.Instant;
  readonly afterUserId?: UserId;
  readonly limit: number;
}

export abstract class UserSubscriptionProjectionRepositoryPort {
  /** User가 없으면 던진다(DatabaseRecordNotFoundError). */
  abstract update(userId: UserId, projection: UserSubscriptionProjection): Promise<void>;
  /**
   * User projection은 ACTIVE인데 Access 판단으로는 프리미엄이 끝난 사용자를 userId 순으로 읽는다.
   * 만료 웹훅을 잃은 스토어 구독자가 대상이고, 다시 계산하면 조건에서 빠진다.
   */
  abstract listLapsedPremiumUserIds(params: ListLapsedPremiumUsersParams): Promise<UserId[]>;
}

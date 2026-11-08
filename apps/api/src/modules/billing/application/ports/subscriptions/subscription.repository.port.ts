import type {
  StorePeriodType,
  SubscriptionEnvironment,
  SubscriptionStatus,
} from "@aido/api/vocabulary";

import type { Subscription } from "../../../domain/aggregates/subscriptions/subscription.aggregate.js";
import type { StoreSubscriptionEntitlement } from "../../../domain/policies/subscriptions/premium-access.policy.js";

export const SUBSCRIPTION_REPOSITORY = Symbol("SUBSCRIPTION_REPOSITORY");

/** RevenueCat appUserId 매핑에 필요한 사용자 읽기 프로젝션 */
export interface SubscriptionUser {
  id: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: Date | null;
  revenueCatUserId: string | null;
  profile: { name: string | null } | null;
}

/** 구독 생성 데이터 (INITIAL_PURCHASE용) */
export interface CreateSubscriptionData {
  userId: string;
  revenueCatId: string;
  productId: string;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date;
  lastProcessedEventId?: string | null;
  /** 구매 웹훅의 결제 환경. 웹훅이 보내지 않으면 null(알 수 없음)이다. */
  environment?: SubscriptionEnvironment | null;
  /** 구매 웹훅의 period_type. 모르면 null(NORMAL)이다. */
  periodType?: StorePeriodType | null;
}

/** 구독 상태 업데이트 데이터 */
export interface UpdateSubscriptionStatusData {
  status?: SubscriptionStatus;
  expiresAt?: Date;
  gracePeriodEndsAt?: Date | null;
  cancelledAt?: Date | null;
  productId?: string;
  lastProcessedEventId?: string | null;
  periodType?: StorePeriodType | null;
}

/** User 테이블 구독 상태 동기화 데이터 */
export interface UpdateUserSubscriptionStatusData {
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: Date | null;
  revenueCatUserId?: string;
}

export interface FindLapsedPremiumUsersParams {
  readonly now: Date;
  readonly afterUserId?: string;
  readonly limit: number;
}

export interface FindTrialEndingNoticesParams {
  readonly now: Date;
  /** 이 시각 이전에 끝나는 체험만 고른다. */
  readonly endsBefore: Date;
  /** 같은 실행에서 이미 본 후보 다음부터 읽는다(expiresAt, id 순 keyset). */
  readonly after?: { readonly expiresAt: Date; readonly subscriptionId: number };
  readonly limit: number;
}

/** 아직 종료 안내를 보내지 않은 무료 체험 구독 */
export interface TrialEndingNotice {
  readonly subscriptionId: number;
  readonly userId: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
  /** 해지하지 않아 체험이 끝나면 결제가 이어지는지 */
  readonly willRenew: boolean;
}

/**
 * 구독 저장소 포트.
 *
 * RevenueCat 웹훅으로 수신한 구독 이벤트를 DB에 반영한다. 트랜잭션은 CLS로 전파된다.
 */
export interface SubscriptionRepositoryPort {
  findByRevenueCatId(revenueCatId: string): Promise<Subscription | null>;
  findUserByAppUserId(appUserId: string): Promise<SubscriptionUser | null>;
  /** 이 사용자가 소유한 삭제되지 않은 스토어 구독 행을 한 번에 읽는다. */
  findStoreEntitlements(userId: string): Promise<StoreSubscriptionEntitlement[]>;
  /** 이 체인의 이벤트가 온 사용자를 행의 소유자로 정한다. 다른 사용자 행이었으면 옮기고 true를 반환한다. */
  claimChain(revenueCatId: string, userId: string): Promise<boolean>;
  /** TRANSFER로 넘겨준 사용자의 삭제되지 않은 행을 받은 사용자에게 옮기고 옮긴 행 수를 반환한다. */
  takeOverChains(fromUserId: string, toUserId: string): Promise<number>;
  /**
   * User projection은 ACTIVE인데 Access 판단으로는 프리미엄이 끝난 사용자를 userId 순으로 읽는다.
   * 만료 웹훅을 잃은 스토어 구독자가 대상이고, 다시 계산하면 조건에서 빠진다.
   */
  findLapsedPremiumUserIds(params: FindLapsedPremiumUsersParams): Promise<string[]>;
  /** 지금~endsBefore에 끝나는, 안내하지 않은 체험 구독을 끝나는 순서로 읽는다. */
  findTrialEndingNotices(params: FindTrialEndingNoticesParams): Promise<TrialEndingNotice[]>;
  /**
   * 아직 안내하지 않은 행만 안내 시각을 기록하고 기록한 id를 돌려준다. 같은 행을 두 실행이 함께
   * 고르면 행 잠금 뒤 조건을 다시 보므로 한 실행만 그 행을 얻는다.
   */
  claimTrialEndingNotices(subscriptionIds: readonly number[], notifiedAt: Date): Promise<number[]>;
  create(data: CreateSubscriptionData): Promise<void>;
  updateStatus(revenueCatId: string, data: UpdateSubscriptionStatusData): Promise<void>;
  updateUserSubscriptionStatus(
    userId: string,
    data: UpdateUserSubscriptionStatusData,
  ): Promise<void>;
}

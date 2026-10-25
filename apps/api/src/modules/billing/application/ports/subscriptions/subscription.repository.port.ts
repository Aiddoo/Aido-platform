import type {
  Subscription,
  SubscriptionStatusValue,
} from "../../../domain/aggregates/subscriptions/subscription.aggregate.js";
import type { StoreSubscriptionEntitlement } from "../../../domain/policies/subscriptions/premium-access.policy.js";

export const SUBSCRIPTION_REPOSITORY = Symbol("SUBSCRIPTION_REPOSITORY");

/** RevenueCat appUserId 매핑에 필요한 사용자 읽기 프로젝션 */
export interface SubscriptionUser {
  id: string;
  email: string;
  subscriptionStatus: SubscriptionStatusValue;
  subscriptionExpiresAt: Date | null;
  revenueCatUserId: string | null;
  profile: { name: string | null } | null;
}

/** 구독 생성 데이터 (INITIAL_PURCHASE용) */
export interface CreateSubscriptionData {
  userId: string;
  revenueCatId: string;
  productId: string;
  status: SubscriptionStatusValue;
  startedAt: Date;
  expiresAt: Date;
  lastProcessedEventId?: string | null;
}

/** 구독 상태 업데이트 데이터 */
export interface UpdateSubscriptionStatusData {
  status?: SubscriptionStatusValue;
  expiresAt?: Date;
  cancelledAt?: Date | null;
  productId?: string;
  lastProcessedEventId?: string | null;
}

/** User 테이블 구독 상태 동기화 데이터 */
export interface UpdateUserSubscriptionStatusData {
  subscriptionStatus: SubscriptionStatusValue;
  subscriptionExpiresAt?: Date | null;
  revenueCatUserId?: string;
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
  create(data: CreateSubscriptionData): Promise<void>;
  updateStatus(revenueCatId: string, data: UpdateSubscriptionStatusData): Promise<void>;
  updateUserSubscriptionStatus(
    userId: string,
    data: UpdateUserSubscriptionStatusData,
  ): Promise<void>;
}

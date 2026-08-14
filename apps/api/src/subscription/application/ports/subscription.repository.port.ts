import type {
	Subscription,
	SubscriptionStatusValue,
} from "../../domain/entities/subscription.aggregate";

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
	lastProcessedEventId?: string;
}

/** 구독 상태 업데이트 데이터 */
export interface UpdateSubscriptionStatusData {
	status?: SubscriptionStatusValue;
	expiresAt?: Date;
	cancelledAt?: Date | null;
	productId?: string;
	lastProcessedEventId?: string;
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
	create(data: CreateSubscriptionData): Promise<void>;
	updateStatus(revenueCatId: string, data: UpdateSubscriptionStatusData): Promise<void>;
	updateUserSubscriptionStatus(
		userId: string,
		data: UpdateUserSubscriptionStatusData,
	): Promise<void>;
}

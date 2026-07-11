import { isSame } from "@/shared/domain/date/utils/compare";

/** 구독 상태 — Prisma SubscriptionStatus와 동일한 리터럴(도메인 계층은 generated를 참조하지 않는다) */
export type SubscriptionStatusValue =
	| "FREE"
	| "ACTIVE"
	| "EXPIRED"
	| "CANCELLED";

export interface SubscriptionProps {
	id: number;
	userId: string;
	revenueCatId: string;
	productId: string;
	status: SubscriptionStatusValue;
	startedAt: Date;
	expiresAt: Date;
	cancelledAt: Date | null;
	lastProcessedEventId: string | null;
}

/**
 * 구독 애그리게잇.
 *
 * RevenueCat 거래(revenueCatId) 단위의 구독 레코드를 표현하며, 멱등성 판정에 필요한
 * 상태·만료·마지막 처리 이벤트 조회 행위를 소유한다. 상태 전이(갱신/취소/만료)는 웹훅
 * 유스케이스가 저장소를 통해 반영하므로, 이 애그리게잇은 읽기 판정만 담당한다.
 */
export class Subscription {
	private constructor(private readonly props: SubscriptionProps) {}

	static reconstitute(props: SubscriptionProps): Subscription {
		return new Subscription(props);
	}

	get id(): number {
		return this.props.id;
	}

	get userId(): string {
		return this.props.userId;
	}

	get revenueCatId(): string {
		return this.props.revenueCatId;
	}

	get productId(): string {
		return this.props.productId;
	}

	get status(): SubscriptionStatusValue {
		return this.props.status;
	}

	get expiresAt(): Date {
		return this.props.expiresAt;
	}

	get cancelledAt(): Date | null {
		return this.props.cancelledAt;
	}

	get lastProcessedEventId(): string | null {
		return this.props.lastProcessedEventId;
	}

	isActive(): boolean {
		return this.props.status === "ACTIVE";
	}

	/** 동일 만료 시각으로 이미 갱신된 ACTIVE 구독인지(RENEWAL 멱등성 판정) */
	isActiveWithSameExpiry(expiresAt: Date): boolean {
		return this.isActive() && isSame(this.props.expiresAt, expiresAt);
	}

	/** 해당 event.id로 이미 처리된 구독인지(웹훅 재전송 멱등성 판정) */
	wasProcessedWith(eventId: string): boolean {
		return this.props.lastProcessedEventId === eventId;
	}
}

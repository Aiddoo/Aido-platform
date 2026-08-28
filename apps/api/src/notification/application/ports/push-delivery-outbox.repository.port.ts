import type { PushDeliveryPublication } from "../types/push-delivery.types";

export const PUSH_DELIVERY_OUTBOX_REPOSITORY = Symbol("PUSH_DELIVERY_OUTBOX_REPOSITORY");

export interface ClaimPushDeliveryOutboxInput {
	readonly limit: number;
	readonly lockedAt: Date;
}

export interface DeferPushDeliveryPublicationsInput {
	readonly publications: readonly PushDeliveryPublication[];
	readonly availableAt: Date;
	readonly error: string;
}

/**
 * 일반 알림 outbox의 claim generation과 relay 상태 전이를 원자적으로 저장한다.
 * 상태 변경 메서드는 정렬된 row lock을 유지하도록 UNIT_OF_WORK 안에서 호출한다.
 */
export interface PushDeliveryOutboxRepositoryPort {
	claimByDispatchIds(
		dispatchIds: readonly number[],
		lockedAt: Date,
	): Promise<readonly PushDeliveryPublication[]>;
	claimAvailable(input: ClaimPushDeliveryOutboxInput): Promise<readonly PushDeliveryPublication[]>;
	markPublished(
		publications: readonly PushDeliveryPublication[],
		publishedAt: Date,
	): Promise<number>;
	defer(input: DeferPushDeliveryPublicationsInput): Promise<number>;
	recoverStaleProcessing(lockedBefore: Date): Promise<number>;
}

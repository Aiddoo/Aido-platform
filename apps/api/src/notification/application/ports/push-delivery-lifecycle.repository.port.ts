import type {
	PushDeliveryItem,
	PushDeliveryPublication,
	PushDispatchSkipReason,
} from "../types/push-delivery.types";
import type { PushDeliveryMode } from "./push-dispatch-staging.repository.port";
import type { PushResult } from "./push-provider.port";

export const PUSH_DELIVERY_LIFECYCLE_REPOSITORY = Symbol("PUSH_DELIVERY_LIFECYCLE_REPOSITORY");

export interface PushDeliveryFence {
	readonly dispatchId: number;
	readonly publishAttempt: number;
	readonly processingJobId: string;
	readonly deliveryAttemptCount: number;
}

export interface ClaimedPushDelivery {
	readonly fence: PushDeliveryFence;
	readonly deliveryMode: PushDeliveryMode;
	readonly force: boolean;
	readonly rateLimitReservation: { readonly status: "pending" } | { readonly status: "reserved" };
	readonly item: PushDeliveryItem;
}

export interface PushDeliveryContext {
	readonly timezone: string;
	readonly localDate: Date;
}

export interface ClaimPushDeliveriesInput {
	readonly publications: readonly PushDeliveryPublication[];
	readonly processingJobId: string;
	readonly processingJobAttempt: number;
	readonly startedAt: Date;
}

export interface ReopenPushDeliveriesAfterClaimFailureInput {
	readonly publications: readonly PushDeliveryPublication[];
	readonly availableAt: Date;
	readonly error: string;
}

export interface FinalizeSkippedPushDeliveryInput {
	readonly fence: PushDeliveryFence;
	readonly context: PushDeliveryContext;
	readonly reason: PushDispatchSkipReason;
}

export interface ReservePushDeliveryRateLimitInput {
	readonly fence: PushDeliveryFence;
	readonly reservedAt: Date;
}

export interface FinalizePushDeliveryResultsInput {
	readonly fence: PushDeliveryFence;
	readonly context: PushDeliveryContext;
	readonly results: readonly PushResult[];
}

export interface ReleasePushDeliveryInput {
	readonly fence: PushDeliveryFence;
	readonly error: string;
	/** JobRuntime의 마지막 attempt일 때만 새 publication generation을 열어 둔다. */
	readonly reopenOutbox: boolean;
	readonly availableAt: Date;
}

/** PushDispatch worker lease를 job ID와 증가 attempt로 fencing한다. */
export interface PushDeliveryLifecycleRepositoryPort {
	/** Outbox ownership과 dispatch lease를 함께 rollback할 수 있도록 UNIT_OF_WORK 안에서 호출한다. */
	claim(input: ClaimPushDeliveriesInput): Promise<readonly ClaimedPushDelivery[]>;
	/** Generation row lock 뒤 최신 dispatch 상태를 재검사하므로 UNIT_OF_WORK 안에서 호출한다. */
	reopenAfterFinalClaimFailure(input: ReopenPushDeliveriesAfterClaimFailureInput): Promise<number>;
	/** DLQ에서 현재 generation 중 안전하게 재발행 가능한 subset만 UNIT_OF_WORK 안에서 연다. */
	reopenFailedPublications(input: ReopenPushDeliveriesAfterClaimFailureInput): Promise<number>;
	markRateLimitReserved(
		inputs: readonly ReservePushDeliveryRateLimitInput[],
	): Promise<readonly number[]>;
	finalizeSkipped(inputs: readonly FinalizeSkippedPushDeliveryInput[]): Promise<number>;
	finalizeResults(inputs: readonly FinalizePushDeliveryResultsInput[]): Promise<number>;
	release(inputs: readonly ReleasePushDeliveryInput[]): Promise<number>;
	recoverStaleProcessing(startedBefore: Date): Promise<number>;
}

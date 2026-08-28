import type { RetentionStageName, RetentionVariant } from "../../domain/retention.constants";

export const RETENTION_REPOSITORY = Symbol("RETENTION_REPOSITORY");

export interface RetentionStageCandidate {
	readonly assignmentId: string;
	readonly stageId: string;
	readonly userId: string;
	readonly variant: RetentionVariant;
	readonly stage: RetentionStageName;
	readonly startedAt: Date;
	readonly timezone: string;
	readonly locale: "ko" | "en";
	readonly pushEnabled: boolean;
	readonly nightPushEnabled: boolean;
	readonly marketingPushAgreedAt: Date | null;
	readonly activeTokenCount: number;
	readonly lastActiveAt: Date | null;
	readonly todoCount: number;
	readonly completedCount: number;
	readonly incompleteCount: number;
	readonly todoActionWithinWindow: boolean;
}

export interface CreateRetentionDeliveryInput {
	readonly stageId: string;
	readonly userId: string;
	readonly timezone: string;
	readonly title: string;
	readonly body: string;
	readonly route: "/feed" | "/achievements";
	readonly variantId: string;
}

export interface ClaimedOutbox {
	readonly id: string;
	readonly attempts: number;
}

export interface RetentionDispatchCandidate {
	readonly fence: RetentionDispatchFence;
	readonly outboxId: string;
	readonly dispatchId: number;
	readonly notificationId: number;
	readonly userId: string;
	readonly title: string;
	readonly body: string;
	readonly actionUrl: string;
	readonly campaignKey: string;
	readonly variantId: string;
	readonly timezone: string;
	readonly pushEnabled: boolean;
	readonly nightPushEnabled: boolean;
	readonly marketingPushAgreedAt: Date | null;
	readonly rateLimitReserved: boolean;
	readonly tokens: ReadonlyArray<{
		readonly id: number;
		readonly token: string;
	}>;
}

export interface RetentionDispatchFence {
	readonly outboxId: string;
	readonly dispatchId: number;
	readonly publishAttempt: number;
	readonly processingJobId: string;
	readonly deliveryAttemptCount: number;
}

export interface RetentionDeliveryResult {
	readonly token: string;
	readonly success: boolean;
	readonly ticketId?: string;
	readonly errorCode?: string;
	readonly error?: string;
}

export interface RetentionRepositoryPort {
	enroll(input: {
		userId: string;
		variant: RetentionVariant;
		startedAt: Date | null;
	}): Promise<void>;
	activate(userId: string, startedAt: Date): Promise<boolean>;
	findScheduledStages(limit: number): Promise<RetentionStageCandidate[]>;
	markStageSkipped(stageId: string, reason: string): Promise<boolean>;
	createDelivery(input: CreateRetentionDeliveryInput): Promise<boolean>;
	recordD7Result(input: {
		assignmentId: string;
		returnedWithinD7: boolean;
		todoActionWithinD7: boolean;
	}): Promise<void>;
	recoverStaleOutboxes(cutoff: Date): Promise<number>;
	recoverStaleDispatches(cutoff: Date): Promise<number>;
	claimOutboxes(limit: number, now: Date): Promise<ClaimedOutbox[]>;
	markOutboxPublished(outbox: ClaimedOutbox): Promise<void>;
	/** Generation lock 뒤 최신 dispatch 상태를 재검사하므로 UNIT_OF_WORK 안에서 호출한다. */
	deferOutbox(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
		readonly availableAt: Date;
	}): Promise<void>;
	markOutboxFailed(input: {
		outboxId: string;
		publishAttempt: number;
		hasExhaustedRetries: boolean;
		error: string;
		nextAttemptAt: Date;
	}): Promise<void>;
	/** Outbox ownership과 dispatch lease를 함께 rollback할 수 있도록 UNIT_OF_WORK 안에서 호출한다. */
	claimDispatch(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
		readonly processingJobId: string;
		readonly processingJobAttempt: number;
		readonly startedAt: Date;
	}): Promise<RetentionDispatchCandidate | null>;
	releaseDispatchForRetry(input: {
		readonly fence: RetentionDispatchFence;
		readonly reason: string;
		readonly availableAt: Date;
		readonly hasExhaustedRetries: boolean;
	}): Promise<boolean>;
	/** Generation lock 뒤 최신 dispatch 상태를 재검사하므로 UNIT_OF_WORK 안에서 호출한다. */
	reopenUnclaimedDispatch(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
		readonly availableAt: Date;
		readonly reason: string;
	}): Promise<boolean>;
	markRateLimitReserved(fence: RetentionDispatchFence, reservedAt: Date): Promise<boolean>;
	markDispatchSkipped(fence: RetentionDispatchFence, reason: string): Promise<boolean>;
	recordDeliveryResults(
		fence: RetentionDispatchFence,
		results: RetentionDeliveryResult[],
	): Promise<boolean>;
}

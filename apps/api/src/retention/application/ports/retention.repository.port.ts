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
	readonly tokens: ReadonlyArray<{
		readonly id: number;
		readonly token: string;
	}>;
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
	claimOutboxes(limit: number, now: Date): Promise<ClaimedOutbox[]>;
	markOutboxPublished(outboxId: string): Promise<void>;
	deferOutbox(outboxId: string, availableAt: Date): Promise<void>;
	markOutboxFailed(input: {
		outboxId: string;
		hasExhaustedRetries: boolean;
		error: string;
		nextAttemptAt: Date;
	}): Promise<void>;
	claimDispatch(outboxId: string): Promise<RetentionDispatchCandidate | null>;
	releaseDispatch(dispatchId: number, reason: string): Promise<void>;
	markDispatchSkipped(dispatchId: number, reason: string): Promise<void>;
	recordDeliveryResults(dispatchId: number, results: RetentionDeliveryResult[]): Promise<void>;
}

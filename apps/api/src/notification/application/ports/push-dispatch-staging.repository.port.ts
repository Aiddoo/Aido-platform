export const PUSH_DISPATCH_STAGING = Symbol("PUSH_DISPATCH_STAGING");

export type PushDeliveryMode = "SINGLE" | "BATCH";

export interface StagePushDispatchInput {
	readonly notificationId: number;
	readonly userId: string;
	readonly purpose: "TRANSACTIONAL" | "SCHEDULED_SERVICE" | "ENGAGEMENT";
	readonly campaignKey?: string | null;
	readonly variantId?: string | null;
	readonly deliveryMode: PushDeliveryMode;
	readonly force: boolean;
}

export interface StagedPushDispatch {
	readonly dispatchId: number;
	readonly notificationId: number;
}

/** 알림 transaction 안에서 일반 push dispatch와 전용 outbox를 함께 생성한다. */
export interface PushDispatchStagingRepositoryPort {
	stage(input: StagePushDispatchInput): Promise<StagedPushDispatch>;
	stageMany(inputs: readonly StagePushDispatchInput[]): Promise<readonly StagedPushDispatch[]>;
}

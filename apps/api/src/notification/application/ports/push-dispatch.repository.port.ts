import type { PushResult } from "./push-provider.port";

export const PUSH_DISPATCH_REPOSITORY = Symbol("PUSH_DISPATCH_REPOSITORY");

export type PushDispatchSkipReason =
	| "PUSH_SETTINGS_MISSING"
	| "PUSH_DISABLED"
	| "MARKETING_CONSENT_REQUIRED"
	| "MARKETING_QUIET_HOURS"
	| "NIGHT_PUSH_DISABLED"
	| "RATE_LIMITED"
	| "ENGAGEMENT_RATE_LIMITED"
	| "NO_ACTIVE_TOKEN"
	| "UNSUPPORTED_APP_CAPABILITY";

export type PushDispatchFailureReason = "UNEXPECTED_DISPATCH_ERROR";

export interface CreatePushDispatchInput {
	readonly notificationId: number;
	readonly userId: string;
	readonly purpose: "TRANSACTIONAL" | "SCHEDULED_SERVICE" | "ENGAGEMENT";
	readonly campaignKey?: string | null;
	readonly variantId?: string | null;
	readonly timezone: string;
	readonly localDate: Date;
}

export interface PushDispatchRecord {
	readonly id: number;
	readonly notificationId: number;
}

export interface PushDispatchSkipUpdate {
	readonly dispatchId: number;
	readonly reason: PushDispatchSkipReason;
}

export interface PushDeliveryResultsInput {
	readonly dispatchId: number;
	readonly results: PushResult[];
}

/** 푸시 발송 시도와 전송 결과 상태를 저장하는 포트. */
export interface PushDispatchRepositoryPort {
	createPushDispatch(input: CreatePushDispatchInput): Promise<{ id: number }>;
	createPushDispatches(inputs: CreatePushDispatchInput[]): Promise<PushDispatchRecord[]>;
	markPushDispatchSkipped(dispatchId: number, reason: PushDispatchSkipReason): Promise<void>;
	markPushDispatchesSkipped(updates: PushDispatchSkipUpdate[]): Promise<void>;
	markPushDispatchFailed(dispatchIds: number[], reason: PushDispatchFailureReason): Promise<void>;
	recordPushDeliveryResults(dispatchId: number, results: PushResult[]): Promise<void>;
	recordPushDeliveryResultsBatch(inputs: PushDeliveryResultsInput[]): Promise<void>;
}

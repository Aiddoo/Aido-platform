import type {
	RetentionDeliveryResult,
	RetentionDispatchCandidate,
} from "./retention.repository.port";

export const RETENTION_PUSH_SENDER = Symbol("RETENTION_PUSH_SENDER");

export interface RetentionPushSenderPort {
	isEligible(candidate: RetentionDispatchCandidate, now: Date): boolean;
	reserveRateLimit(candidate: RetentionDispatchCandidate, now: Date): Promise<boolean>;
	send(candidate: RetentionDispatchCandidate): Promise<RetentionDeliveryResult[]>;
}

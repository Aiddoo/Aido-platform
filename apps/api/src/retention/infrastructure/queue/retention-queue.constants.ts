export const RETENTION_QUEUE = "retention";

export const RetentionJobName = {
	STAGE_SWEEP: "retention-stage-sweep",
	OUTBOX_RELAY: "retention-outbox-relay",
	DISPATCH: "retention-dispatch",
} as const;

export interface RetentionJobMap {
	[RetentionJobName.STAGE_SWEEP]: Record<string, never>;
	[RetentionJobName.OUTBOX_RELAY]: Record<string, never>;
	[RetentionJobName.DISPATCH]: { outboxId: string };
}

export type RetentionJobData = RetentionJobMap[keyof RetentionJobMap];

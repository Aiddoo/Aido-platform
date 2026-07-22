export const RETENTION_QUEUE = "retention.v1";
export const RETENTION_LEGACY_QUEUE = "retention";

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

export type RetentionRuntimeJob = {
	[K in keyof RetentionJobMap]: {
		readonly name: K;
		readonly data: RetentionJobMap[K];
	};
}[keyof RetentionJobMap];

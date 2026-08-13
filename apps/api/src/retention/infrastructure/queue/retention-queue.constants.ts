import { z } from "zod";

export const RETENTION_QUEUE = "retention.v1";
export const RETENTION_LEGACY_QUEUE = "retention";

export const RetentionJobName = {
	STAGE_SWEEP: "retention-stage-sweep",
	OUTBOX_RELAY: "retention-outbox-relay",
	DISPATCH: "retention-dispatch",
} as const;

export const RETENTION_WORKER_POLICY = {
	teamSize: 1,
	pollingIntervalSeconds: 2,
} as const;

export const RetentionRuntimeJobSchema = z.discriminatedUnion("name", [
	z.object({
		name: z.literal(RetentionJobName.STAGE_SWEEP),
		data: z.object({}),
	}),
	z.object({
		name: z.literal(RetentionJobName.OUTBOX_RELAY),
		data: z.object({}),
	}),
	z.object({
		name: z.literal(RetentionJobName.DISPATCH),
		data: z.object({ outboxId: z.string().min(1) }),
	}),
]);

export interface RetentionJobMap {
	[RetentionJobName.STAGE_SWEEP]: Record<string, never>;
	[RetentionJobName.OUTBOX_RELAY]: Record<string, never>;
	[RetentionJobName.DISPATCH]: { outboxId: string };
}

export type RetentionJobData = RetentionJobMap[keyof RetentionJobMap];

export type RetentionRuntimeJob = z.infer<typeof RetentionRuntimeJobSchema>;

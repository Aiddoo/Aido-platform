import { z } from "zod";

import { JOB_POLLING_SECONDS } from "@/shared/application/ports";

export const RETENTION_QUEUE = "retention.v1";
export const RETENTION_DEAD_LETTER_QUEUE = "retention-dead-letter.v1";
export const RETENTION_LEGACY_QUEUE = "retention";

export const RetentionJobName = {
	STAGE_SWEEP: "retention-stage-sweep",
	OUTBOX_RELAY: "retention-outbox-relay",
	DISPATCH: "retention-dispatch",
} as const;

export const RETENTION_WORKER_POLICY = {
	teamSize: 1,
	pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;

const RetentionDispatchJobSchema = z
	.object({
		name: z.literal(RetentionJobName.DISPATCH),
		data: z
			.object({
				outboxId: z.string().min(1),
				// rolling 배포 전 enqueue된 payload는 generation이 없다.
				publishAttempt: z.number().int().positive().optional(),
			})
			.strict(),
	})
	.strict();

export const RetentionRuntimeJobSchema = z.discriminatedUnion("name", [
	z
		.object({
			name: z.literal(RetentionJobName.STAGE_SWEEP),
			data: z.object({}).strict(),
		})
		.strict(),
	z
		.object({
			name: z.literal(RetentionJobName.OUTBOX_RELAY),
			data: z.object({}).strict(),
		})
		.strict(),
	RetentionDispatchJobSchema,
]);

export const RetentionDeadLetterJobSchema = RetentionDispatchJobSchema;

export const RETENTION_JOB_POLICY = {
	retryLimit: 4,
	retryDelaySeconds: 1,
	retryBackoff: true,
	expireInSeconds: 5 * 60,
	retentionSeconds: 7 * 24 * 60 * 60,
	deleteAfterSeconds: 24 * 60 * 60,
} as const;

export const RETENTION_DEAD_LETTER_JOB_POLICY = {
	...RETENTION_JOB_POLICY,
} as const;

export const RETENTION_DEAD_LETTER_WORKER_POLICY = {
	...RETENTION_WORKER_POLICY,
	queuePolicy: RETENTION_DEAD_LETTER_JOB_POLICY,
} as const;

export const RETENTION_DISPATCH_JOB_POLICY = {
	...RETENTION_JOB_POLICY,
	deadLetter: {
		queue: RETENTION_DEAD_LETTER_QUEUE,
		jobPolicy: RETENTION_DEAD_LETTER_JOB_POLICY,
	},
} as const;

export type RetentionRuntimeJob = z.output<typeof RetentionRuntimeJobSchema>;
export type RetentionJobMap = {
	[TJob in RetentionRuntimeJob as TJob["name"]]: TJob["data"];
};
export type RetentionJobData = RetentionRuntimeJob["data"];

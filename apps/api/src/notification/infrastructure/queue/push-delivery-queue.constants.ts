import { z } from "zod";

import { JOB_POLLING_SECONDS } from "@/shared/application/ports";

export const PUSH_DELIVERY_QUEUE = "push-delivery.v1";
export const PUSH_DELIVERY_DEAD_LETTER_QUEUE = "push-delivery-dead-letter.v1";

export const PushDeliveryJobName = {
	RELAY_OUTBOX: "relay-outbox",
	DELIVER_DISPATCHES: "deliver-dispatches",
} as const;

const PushDeliveryPublicationSchema = z
	.object({
		dispatchId: z.number().int().positive(),
		publishAttempt: z.number().int().positive(),
	})
	.strict();

const PushDeliveryPublicationBatchSchema = z
	.array(PushDeliveryPublicationSchema)
	.min(1)
	.max(100)
	.superRefine((publications, context) => {
		const dispatchIds = new Set<number>();
		for (const publication of publications) {
			if (dispatchIds.has(publication.dispatchId)) {
				context.addIssue({
					code: "custom",
					message: `Duplicate dispatchId: ${publication.dispatchId}`,
				});
			}
			dispatchIds.add(publication.dispatchId);
		}
	});

const DeliverPushNotificationsJobSchema = z
	.object({
		name: z.literal(PushDeliveryJobName.DELIVER_DISPATCHES),
		data: PushDeliveryPublicationBatchSchema,
	})
	.strict();

export const PushDeliveryRuntimeJobSchema = z.discriminatedUnion("name", [
	z
		.object({
			name: z.literal(PushDeliveryJobName.RELAY_OUTBOX),
			data: z.object({}).strict(),
		})
		.strict(),
	DeliverPushNotificationsJobSchema,
]);

/** Native DLQ는 원본 delivery payload만 수용하고 relay job은 받지 않는다. */
export const PushDeliveryDeadLetterJobSchema = DeliverPushNotificationsJobSchema;

export const PUSH_DELIVERY_WORKER_POLICY = {
	teamSize: 5,
	pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
} as const;

export const PUSH_DELIVERY_JOB_POLICY = {
	retryLimit: 5,
	retryDelaySeconds: 1,
	retryBackoff: true,
	expireInSeconds: 5 * 60,
	retentionSeconds: 7 * 24 * 60 * 60,
	deleteAfterSeconds: 24 * 60 * 60,
} as const;

export const PUSH_DELIVERY_DEAD_LETTER_JOB_POLICY = {
	...PUSH_DELIVERY_JOB_POLICY,
} as const;

export const PUSH_DELIVERY_DEAD_LETTER_WORKER_POLICY = {
	...PUSH_DELIVERY_WORKER_POLICY,
	queuePolicy: PUSH_DELIVERY_DEAD_LETTER_JOB_POLICY,
} as const;

export const PUSH_DELIVERY_DISPATCH_JOB_POLICY = {
	...PUSH_DELIVERY_JOB_POLICY,
	deadLetter: {
		queue: PUSH_DELIVERY_DEAD_LETTER_QUEUE,
		jobPolicy: PUSH_DELIVERY_DEAD_LETTER_JOB_POLICY,
	},
} as const;

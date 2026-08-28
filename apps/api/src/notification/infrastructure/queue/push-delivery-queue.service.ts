import { createHash } from "node:crypto";

import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports";
import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";

import type { PushDeliveryJobEnqueuerPort } from "../../application/ports/push-delivery-job-enqueuer.port";
import type { PushDeliveryPublication } from "../../application/types/push-delivery.types";
import {
	PUSH_DELIVERY_DISPATCH_JOB_POLICY,
	PUSH_DELIVERY_JOB_POLICY,
	PUSH_DELIVERY_QUEUE,
	PushDeliveryJobName,
} from "./push-delivery-queue.constants";

function deliveryIdempotencyKey(publications: readonly PushDeliveryPublication[]): string {
	const generationFingerprint = [...publications]
		.sort(
			(left, right) =>
				left.dispatchId - right.dispatchId || left.publishAttempt - right.publishAttempt,
		)
		.map((item) => `${item.dispatchId}-${item.publishAttempt}`)
		.join(".");
	const digest = createHash("sha256").update(generationFingerprint).digest("hex");
	return `push-delivery-${digest}`;
}

@Injectable()
export class PushDeliveryQueueService implements PushDeliveryJobEnqueuerPort, OnModuleInit {
	readonly #logger = new Logger(PushDeliveryQueueService.name);
	schedulerRegistration: Promise<void> = Promise.resolve();

	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	onModuleInit(): void {
		this.schedulerRegistration = runInBackground(
			this.#logger,
			"Push delivery outbox relay scheduler registration",
			() =>
				this.runtime.schedule(
					"push-delivery-outbox-relay-scheduler",
					"* * * * *",
					PUSH_DELIVERY_QUEUE,
					{ name: PushDeliveryJobName.RELAY_OUTBOX, data: {} },
					PUSH_DELIVERY_JOB_POLICY,
				),
		);
	}

	async enqueueDeliveries(publications: readonly PushDeliveryPublication[]): Promise<void> {
		await this.runtime.enqueue(
			PUSH_DELIVERY_QUEUE,
			{ name: PushDeliveryJobName.DELIVER_DISPATCHES, data: publications },
			{
				...PUSH_DELIVERY_DISPATCH_JOB_POLICY,
				idempotencyKey: deliveryIdempotencyKey(publications),
			},
		);
	}
}

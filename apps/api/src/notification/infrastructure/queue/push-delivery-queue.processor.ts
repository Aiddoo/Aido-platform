import { Inject, Injectable, type OnModuleInit, Optional } from "@nestjs/common";

import { JOB_RUNTIME, type JobData, type JobRuntimePort } from "@/shared/application/ports";

import { DeliverPushNotificationsUseCase } from "../../application/use-cases/deliver-push-notifications/deliver-push-notifications.use-case";
import { RecoverFailedPushDeliveriesUseCase } from "../../application/use-cases/recover-failed-push-deliveries/recover-failed-push-deliveries.use-case";
import { RelayPushDeliveryOutboxUseCase } from "../../application/use-cases/relay-push-delivery-outbox/relay-push-delivery-outbox.use-case";
import {
	PUSH_DELIVERY_QUEUE,
	PUSH_DELIVERY_DEAD_LETTER_QUEUE,
	PUSH_DELIVERY_DEAD_LETTER_WORKER_POLICY,
	PUSH_DELIVERY_JOB_POLICY,
	PUSH_DELIVERY_WORKER_POLICY,
	PushDeliveryJobName,
	PushDeliveryDeadLetterJobSchema,
	PushDeliveryRuntimeJobSchema,
} from "./push-delivery-queue.constants";

function assertUnreachable(job: never): never {
	throw new Error(`Unhandled push delivery job: ${JSON.stringify(job)}`);
}

/** Queue transport parser/router. Delivery policy and state transitions remain in application. */
@Injectable()
export class PushDeliveryQueueProcessor implements OnModuleInit {
	constructor(
		private readonly relayOutbox: RelayPushDeliveryOutboxUseCase,
		private readonly deliverPushNotifications: DeliverPushNotificationsUseCase,
		private readonly recoverFailedDeliveries: RecoverFailedPushDeliveriesUseCase,
		@Optional()
		@Inject(JOB_RUNTIME)
		private readonly runtime?: JobRuntimePort,
	) {}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		await this.runtime.work<JobData>(
			PUSH_DELIVERY_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.id, job.attempt, job.data);
			},
			PUSH_DELIVERY_WORKER_POLICY,
		);
		await this.runtime.work<JobData>(
			PUSH_DELIVERY_DEAD_LETTER_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.processDeadLetter(job.data);
			},
			PUSH_DELIVERY_DEAD_LETTER_WORKER_POLICY,
		);
	}

	async process(processingJobId: string, jobAttempt: number, untrustedJob: unknown): Promise<void> {
		const job = PushDeliveryRuntimeJobSchema.parse(untrustedJob);
		switch (job.name) {
			case PushDeliveryJobName.RELAY_OUTBOX:
				return this.relayOutbox.execute();
			case PushDeliveryJobName.DELIVER_DISPATCHES:
				return this.deliverPushNotifications.execute({
					processingJobId,
					processingJobAttempt: jobAttempt,
					publications: job.data,
					// JobRuntime은 pg-boss/BullMQ 모두 1-based attempt로 정규화한다.
					isFinalAttempt: jobAttempt > PUSH_DELIVERY_JOB_POLICY.retryLimit,
				});
		}
		return assertUnreachable(job);
	}

	async processDeadLetter(untrustedJob: unknown): Promise<void> {
		const job = PushDeliveryDeadLetterJobSchema.parse(untrustedJob);
		await this.recoverFailedDeliveries.execute({ publications: job.data });
	}
}

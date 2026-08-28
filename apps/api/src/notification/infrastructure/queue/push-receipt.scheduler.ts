import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports";

import {
	NOTIFICATION_JOB_POLICY,
	NOTIFICATION_QUEUE,
	NotificationJobName,
	PUSH_RECEIPT_SCHEDULE,
} from "./notification-queue.constants";

/** Owns the recurring receipt-reconciliation schedule, independently of event publishing. */
@Injectable()
export class PushReceiptScheduler implements OnModuleInit {
	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	async onModuleInit(): Promise<void> {
		await this.runtime.schedule(
			PUSH_RECEIPT_SCHEDULE.key,
			PUSH_RECEIPT_SCHEDULE.cron,
			NOTIFICATION_QUEUE,
			{ name: NotificationJobName.PUSH_RECEIPTS, data: {} },
			NOTIFICATION_JOB_POLICY,
		);
	}
}

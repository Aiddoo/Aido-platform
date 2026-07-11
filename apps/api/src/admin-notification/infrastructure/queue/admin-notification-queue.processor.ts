import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { DispatchDailySignupSummaryUseCase } from "../../application/use-cases/dispatch-daily-signup-summary/dispatch-daily-signup-summary.use-case";
import { SendAdminNotificationUseCase } from "../../application/use-cases/send-admin-notification/send-admin-notification.use-case";
import {
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "./admin-notification-queue.constants";

/**
 * 관리자 알림 BullMQ Processor (진입 어댑터).
 *
 * - dispatch-signup-summary: 스케줄러 트리거 → DispatchDailySignupSummaryUseCase
 * - send-notification: Discord 웹훅 발송 → SendAdminNotificationUseCase
 *
 * concurrency=3: Discord rate limit (30 req/min/webhook) 대응
 */
@Processor(ADMIN_NOTIFICATION_QUEUE, { concurrency: 3 })
export class AdminNotificationProcessor extends WorkerHost {
	readonly #logger = new Logger(AdminNotificationProcessor.name);

	constructor(
		private readonly sendAdminNotification: SendAdminNotificationUseCase,
		private readonly dispatchDailySummary: DispatchDailySignupSummaryUseCase,
	) {
		super();
	}

	@OnWorkerEvent("stalled")
	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	@OnWorkerEvent("error")
	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	@OnWorkerEvent("failed")
	onFailed(job: Job | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(job: Job<AdminNotificationJobData>): Promise<void> {
		if (job.name === AdminNotificationJobName.DISPATCH_SUMMARY) {
			await this.dispatchDailySummary.execute();
			return;
		}

		if (isSendJob(job)) {
			const { channel, notification } = job.data;
			await this.sendAdminNotification.execute(channel, notification);
			return;
		}

		this.#logger.warn(`Unknown job name: ${job.name}`);
	}
}

/** SEND 잡 여부(잡 이름 기반 내로잉) */
function isSendJob(
	job: Job<AdminNotificationJobData>,
): job is Job<AdminNotificationSendData> {
	return job.name === AdminNotificationJobName.SEND;
}

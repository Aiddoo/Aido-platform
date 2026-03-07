import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { DailySignupSummaryJob } from "../jobs/daily-signup-summary.job";
import {
	ADMIN_NOTIFIER,
	type AdminNotifier,
	PAYMENT_NOTIFIER,
} from "../providers/admin-notifier.interface";
import {
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	type AdminNotificationJobMap,
	AdminNotificationJobName,
} from "./admin-notification-queue.constants";

/**
 * 관리자 알림 BullMQ Processor
 *
 * - dispatch-signup-summary: 스케줄러 트리거 → DailySignupSummaryJob.handleDailySummary()
 * - send-notification: Discord 웹훅 발송
 *
 * concurrency=3: Discord rate limit (30 req/min/webhook) 대응
 */
@Processor(ADMIN_NOTIFICATION_QUEUE, { concurrency: 3 })
export class AdminNotificationProcessor extends WorkerHost {
	readonly #logger = new Logger(AdminNotificationProcessor.name);

	/** @see DailySignupSummaryJob — 순환 참조 방지를 위해 setter injection */
	#dailySummaryJob?: DailySignupSummaryJob;
	setDailySummaryJob(job: DailySignupSummaryJob) {
		this.#dailySummaryJob = job;
	}

	constructor(
		@Inject(ADMIN_NOTIFIER)
		private readonly adminNotifier: AdminNotifier,
		@Inject(PAYMENT_NOTIFIER)
		private readonly paymentNotifier: AdminNotifier,
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
			if (!this.#dailySummaryJob) {
				throw new Error("DailySignupSummaryJob not initialized");
			}

			await this.#dailySummaryJob.handleDailySummary();
			return;
		}

		if (job.name !== AdminNotificationJobName.SEND) {
			this.#logger.warn(`Unknown job name: ${job.name}`);
			return;
		}

		const { channel, notification } =
			job.data as AdminNotificationJobMap[typeof AdminNotificationJobName.SEND];
		const notifier =
			channel === "payment" ? this.paymentNotifier : this.adminNotifier;

		this.#logger.debug(
			`Processing admin notification: channel=${channel}, title=${notification.title}`,
		);

		const result = await notifier.send(notification);

		if (!result.success) {
			throw new Error(`Discord webhook failed: ${result.error}`);
		}

		this.#logger.log(
			`Admin notification sent: channel=${channel}, title=${notification.title}`,
		);
	}
}

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import type { DailySignupSummaryJob } from "../jobs/daily-signup-summary.job";
import {
	ADMIN_NOTIFIER,
	type AdminNotification,
	type AdminNotifier,
	PAYMENT_NOTIFIER,
} from "../providers/admin-notifier.interface";

export const ADMIN_NOTIFICATION_QUEUE = "admin-notification";

/** 잡 이름 상수 */
export const AdminNotificationJobName = {
	DISPATCH_SUMMARY: "dispatch-signup-summary",
	SEND: "send-notification",
} as const;

/** send-notification 잡 데이터 */
export interface AdminNotificationSendData {
	channel: "admin" | "payment";
	notification: AdminNotification;
}

/** 잡 이름 → 데이터 타입 매핑 */
export interface AdminNotificationJobMap {
	[AdminNotificationJobName.DISPATCH_SUMMARY]: Record<string, never>;
	[AdminNotificationJobName.SEND]: AdminNotificationSendData;
}

export type AdminNotificationJobData =
	AdminNotificationJobMap[keyof AdminNotificationJobMap];

/** 잡 등록 시 공통 옵션 */
export const ADMIN_NOTIFICATION_JOB_OPTS = {
	attempts: 3,
	backoff: { type: "exponential" as const, delay: 5_000 },
	removeOnComplete: true,
	removeOnFail: { count: 100, age: 86_400 },
} as const;

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
	#dailySummaryJob!: DailySignupSummaryJob;
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

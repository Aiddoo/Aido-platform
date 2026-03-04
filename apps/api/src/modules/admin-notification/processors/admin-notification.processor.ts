import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import {
	ADMIN_NOTIFIER,
	type AdminNotification,
	type AdminNotifier,
	PAYMENT_NOTIFIER,
} from "../providers/admin-notifier.interface";

export const ADMIN_NOTIFICATION_QUEUE = "admin-notification";

/**
 * 관리자 알림 잡 데이터
 *
 * - channel: 발송 대상 채널 (admin=가입, payment=결제)
 * - notification: Discord Embed 페이로드
 */
export interface AdminNotificationJobData {
	channel: "admin" | "payment";
	notification: AdminNotification;
}

/** 잡 등록 시 공통 옵션 */
export const ADMIN_NOTIFICATION_JOB_OPTS = {
	attempts: 3,
	backoff: { type: "exponential" as const, delay: 5_000 },
	removeOnComplete: true,
	removeOnFail: 100,
} as const;

/**
 * 관리자 알림 BullMQ Processor
 *
 * Discord 웹훅 발송을 담당합니다.
 * 실패 시 BullMQ가 자동 재시도 (3회, exponential backoff).
 *
 * concurrency=3: Discord rate limit (30 req/min/webhook) 대응
 */
@Processor(ADMIN_NOTIFICATION_QUEUE, { concurrency: 3 })
export class AdminNotificationProcessor extends WorkerHost {
	readonly #logger = new Logger(AdminNotificationProcessor.name);

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

	async process(job: Job<AdminNotificationJobData>): Promise<void> {
		const { channel, notification } = job.data;
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

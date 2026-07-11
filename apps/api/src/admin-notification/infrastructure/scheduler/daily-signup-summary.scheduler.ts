import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";

import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";

import {
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	AdminNotificationJobName,
} from "../queue/admin-notification-queue.constants";

/**
 * 일일 가입 요약 스케줄러 등록기.
 *
 * 매일 KST 00:00에 DISPATCH_SUMMARY 잡을 트리거하는 BullMQ Job Scheduler를
 * Redis에 등록한다. Redis 다운 중에도 부팅을 블로킹하지 않는다(재연결 시 완료).
 */
@Injectable()
export class DailySignupSummaryScheduler implements OnModuleInit {
	readonly #logger = new Logger(DailySignupSummaryScheduler.name);

	constructor(
		@InjectQueue(ADMIN_NOTIFICATION_QUEUE)
		private readonly queue: Queue<AdminNotificationJobData>,
	) {}

	/** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
	schedulerRegistration: Promise<void> = Promise.resolve();

	onModuleInit(): void {
		this.schedulerRegistration = runInBackground(
			this.#logger,
			"Daily signup summary scheduler registration",
			async () => {
				await this.queue.upsertJobScheduler(
					"daily-signup-summary-scheduler",
					{ pattern: "0 0 * * *", tz: "Asia/Seoul" },
					{ name: AdminNotificationJobName.DISPATCH_SUMMARY, data: {} },
				);

				this.#logger.log("Daily signup summary scheduler registered");
			},
		);
	}
}

import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
	JOB_RUNTIME,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";

import { runInBackground } from "@/shared/infrastructure/bullmq/non-blocking-init";

import {
	ADMIN_NOTIFICATION_QUEUE,
	AdminNotificationJobName,
	DAILY_SIGNUP_SUMMARY_SCHEDULE,
} from "../queue/admin-notification-queue.constants";

/**
 * 일일 가입 요약 스케줄러 등록기.
 *
 * 매일 KST 00:10에 DISPATCH_SUMMARY 잡을 트리거하는 BullMQ Job Scheduler를
 * Redis에 등록한다. Redis 다운 중에도 부팅을 블로킹하지 않는다(재연결 시 완료).
 *
 * 실행 시각을 자정 정각이 아닌 00:10으로 두는 이유: 자정 직전(예: 23:59:59 KST)
 * 가입 트랜잭션의 커밋이 커밋 지연·clock drift로 자정을 미세하게 넘길 수 있어,
 * 자정 정각 집계는 Read Committed 격리에서 해당 레코드를 놓칠 수 있다. 10분 버퍼로
 * 커밋 완료를 보장한다. `computePreviousKstDayRange`는 실행 시각과 무관하게 항상
 * 전일 [00:00, 24:00) KST 범위를 계산하므로 집계 창은 동일하다.
 */
@Injectable()
export class DailySignupSummaryScheduler implements OnModuleInit {
	readonly #logger = new Logger(DailySignupSummaryScheduler.name);

	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	/** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
	schedulerRegistration: Promise<void> = Promise.resolve();

	onModuleInit(): void {
		this.schedulerRegistration = runInBackground(
			this.#logger,
			"Daily signup summary scheduler registration",
			async () => {
				await this.runtime.schedule(
					DAILY_SIGNUP_SUMMARY_SCHEDULE.key,
					DAILY_SIGNUP_SUMMARY_SCHEDULE.cron,
					ADMIN_NOTIFICATION_QUEUE,
					{ name: AdminNotificationJobName.DISPATCH_SUMMARY, data: {} },
					{
						...DAILY_SIGNUP_SUMMARY_SCHEDULE.jobPolicy,
						timezone: DAILY_SIGNUP_SUMMARY_SCHEDULE.timezone,
					},
				);

				this.#logger.log("Daily signup summary scheduler registered");
			},
		);
	}
}

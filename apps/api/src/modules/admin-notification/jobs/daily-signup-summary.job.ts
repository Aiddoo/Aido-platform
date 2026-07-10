import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";

import { runInBackground } from "@/common/bullmq/non-blocking-init";
import { subtractDays } from "@/common/date/utils/arithmetic";
import { toDateString } from "@/common/date/utils/format";
import {
	midnightInTimezone,
	startOfDayInTimezone,
} from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import type { AccountProvider } from "@/generated/prisma/client";
import {
	ADMIN_NOTIFICATION_JOB_OPTS,
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	AdminNotificationJobName,
	AdminNotificationProcessor,
	type AdminNotificationSendData,
} from "../queue";

const PROVIDER_LABELS: Record<AccountProvider, string> = {
	CREDENTIAL: "이메일",
	APPLE: "Apple",
	GOOGLE: "Google",
	KAKAO: "Kakao",
	NAVER: "Naver",
};

/**
 * 일일 가입 요약 스케줄러
 *
 * 매일 KST 00:00에 실행되어
 * 전일(KST) 신규 가입자 수와 총 사용자 수를 집계한 후
 * BullMQ 큐에 알림 잡을 등록합니다.
 *
 * BullMQ Job Scheduler를 사용하여 Redis에 스케줄을 저장합니다.
 */
@Injectable()
export class DailySignupSummaryJob implements OnModuleInit {
	readonly #logger = new Logger(DailySignupSummaryJob.name);

	constructor(
		private readonly database: DatabaseService,
		@InjectQueue(ADMIN_NOTIFICATION_QUEUE)
		private readonly queue: Queue<AdminNotificationJobData>,
		private readonly processor: AdminNotificationProcessor,
	) {}

	/** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
	schedulerRegistration: Promise<void> = Promise.resolve();

	onModuleInit(): void {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setDailySummaryJob(this);

		// Redis 다운 중에도 부팅은 진행 — 오프라인 큐가 재연결 시 등록을 완료한다
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

	/**
	 * 전일 가입 통계 집계 후 알림 잡 등록
	 */
	async handleDailySummary(): Promise<void> {
		this.#logger.log("Starting daily signup summary job...");

		try {
			const { startUtc, endUtc, reportDateStr } =
				this.#getPreviousKstDayRange();

			// 전일(KST) 가입한 사용자의 Account provider별 집계
			const signupsByProvider = await this.database.account.groupBy({
				by: ["provider"],
				where: {
					createdAt: { gte: startUtc, lt: endUtc },
				},
				_count: true,
			});

			const previousDayTotal = signupsByProvider.reduce(
				(sum, group) => sum + group._count,
				0,
			);

			// 전체 사용자 수
			const totalUsers = await this.database.user.count();

			// provider별 내역 텍스트
			const providerBreakdown = signupsByProvider
				.map((group) => {
					const label = PROVIDER_LABELS[group.provider] ?? group.provider;
					return `- ${label}: ${group._count}명`;
				})
				.join("\n");

			await this.queue.add(
				AdminNotificationJobName.SEND,
				{
					channel: "admin",
					notification: {
						title: `일일 가입 리포트 | ${reportDateStr} (KST)`,
						body:
							previousDayTotal > 0
								? `전일 신규 가입은 ${previousDayTotal}명입니다.\n\n가입 채널별\n${providerBreakdown}`
								: "전일 신규 가입은 0명입니다.",
						color: 0x5865f2,
						fields: [
							{
								name: "전일 신규 가입",
								value: `${previousDayTotal}명`,
								inline: true,
							},
							{
								name: "총 사용자 수",
								value: `${totalUsers.toLocaleString()}명`,
								inline: true,
							},
							{
								name: "집계 기준",
								value: `${reportDateStr} 00:00 ~ 23:59 (KST)`,
								inline: false,
							},
						],
					},
				} satisfies AdminNotificationSendData,
				{
					...ADMIN_NOTIFICATION_JOB_OPTS,
					jobId: `signup-summary_${reportDateStr}`,
				},
			);

			this.#logger.log(
				`Daily signup summary job enqueued: ${previousDayTotal} new, ${totalUsers} total`,
			);
		} catch (error) {
			this.#logger.error(
				`Daily signup summary job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	#getPreviousKstDayRange(now = new Date()): {
		startUtc: Date;
		endUtc: Date;
		reportDateStr: string;
	} {
		const kstTodayMidnight = midnightInTimezone(now, "Asia/Seoul");
		const kstYesterdayMidnight = subtractDays(1, kstTodayMidnight);
		const kstYesterdayDate = startOfDayInTimezone(
			kstYesterdayMidnight,
			"Asia/Seoul",
		);

		return {
			startUtc: kstYesterdayMidnight,
			endUtc: kstTodayMidnight,
			reportDateStr: toDateString(kstYesterdayDate),
		};
	}
}

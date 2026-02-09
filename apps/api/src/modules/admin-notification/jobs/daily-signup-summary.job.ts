import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { DatabaseService } from "@/database/database.service";

import {
	ADMIN_NOTIFIER,
	type AdminNotifier,
} from "../providers/admin-notifier.interface";

const PROVIDER_LABELS: Record<string, string> = {
	CREDENTIAL: "이메일",
	APPLE: "Apple",
	GOOGLE: "Google",
	KAKAO: "Kakao",
	NAVER: "Naver",
};

/**
 * 일일 가입 요약 크론 작업
 *
 * 매일 UTC 12:00 (KST 21:00)에 실행되어
 * 당일 신규 가입자 수와 총 사용자 수를 관리자 채널에 발송합니다.
 */
@Injectable()
export class DailySignupSummaryJob {
	private readonly logger = new Logger(DailySignupSummaryJob.name);

	constructor(
		private readonly database: DatabaseService,
		@Inject(ADMIN_NOTIFIER)
		private readonly adminNotifier: AdminNotifier,
	) {}

	/**
	 * 매일 UTC 12:00 (KST 21:00) 실행
	 */
	@Cron("0 12 * * *")
	async handleDailySummary(): Promise<void> {
		this.logger.log("Starting daily signup summary job...");

		try {
			const today = new Date();
			today.setUTCHours(0, 0, 0, 0);

			const tomorrow = new Date(today);
			tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

			// 오늘 가입한 사용자의 Account provider별 집계
			const signupsByProvider = await this.database.account.groupBy({
				by: ["provider"],
				where: {
					createdAt: { gte: today, lt: tomorrow },
				},
				_count: true,
			});

			const todayTotal = signupsByProvider.reduce(
				(sum, group) => sum + group._count,
				0,
			);

			// 전체 사용자 수
			const totalUsers = await this.database.user.count();

			// provider별 내역 텍스트
			const providerBreakdown = signupsByProvider
				.map((group) => {
					const label = PROVIDER_LABELS[group.provider] ?? group.provider;
					return `${label}: ${group._count}명`;
				})
				.join("\n");

			const dateStr = today.toISOString().split("T")[0];

			const result = await this.adminNotifier.send({
				title: `일일 가입 리포트 (${dateStr})`,
				body: providerBreakdown || "오늘 신규 가입자가 없습니다.",
				color: 0x5865f2,
				fields: [
					{
						name: "오늘 신규 가입",
						value: `${todayTotal}명`,
						inline: true,
					},
					{
						name: "총 사용자 수",
						value: `${totalUsers.toLocaleString()}명`,
						inline: true,
					},
				],
			});

			if (result.success) {
				this.logger.log(
					`Daily signup summary sent: ${todayTotal} new, ${totalUsers} total`,
				);
			} else {
				this.logger.warn(
					`Daily signup summary notification failed: ${result.error}`,
				);
			}
		} catch (error) {
			this.logger.error(
				`Daily signup summary job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

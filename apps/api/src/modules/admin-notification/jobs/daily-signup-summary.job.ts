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

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 일일 가입 요약 크론 작업
 *
 * 매일 KST 00:00에 실행되어
 * 전일(KST) 신규 가입자 수와 총 사용자 수를 관리자 채널에 발송합니다.
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
	 * 매일 KST 00:00 실행
	 */
	@Cron("0 0 * * *", { timeZone: "Asia/Seoul" })
	async handleDailySummary(): Promise<void> {
		this.logger.log("Starting daily signup summary job...");

		try {
			const { startUtc, endUtc, reportDateStr } = this.getPreviousKstDayRange();

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

			const result = await this.adminNotifier.send({
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
			});

			if (result.success) {
				this.logger.log(
					`Daily signup summary sent: ${previousDayTotal} new, ${totalUsers} total`,
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

	private getPreviousKstDayRange(now = new Date()): {
		startUtc: Date;
		endUtc: Date;
		reportDateStr: string;
	} {
		const nowMs = now.getTime();
		const kstNowMs = nowMs + KST_OFFSET_MS;
		const kstTodayStartMs = Math.floor(kstNowMs / ONE_DAY_MS) * ONE_DAY_MS;
		const kstPreviousDayStartMs = kstTodayStartMs - ONE_DAY_MS;

		const startUtc = new Date(kstPreviousDayStartMs - KST_OFFSET_MS);
		const endUtc = new Date(kstTodayStartMs - KST_OFFSET_MS);
		const reportDateStr = new Date(kstPreviousDayStartMs)
			.toISOString()
			.slice(0, 10);

		return { startUtc, endUtc, reportDateStr };
	}
}

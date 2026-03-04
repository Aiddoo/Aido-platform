import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { Queue } from "bullmq";
import { forEachBatch } from "@/common/database";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import {
	AI_REPORT_QUEUE,
	type AiReportJobData,
} from "../processors/report-generation.processor";

/** 잠금 TTL: 크론 간격보다 약간 짧게 설정 */
const WEEKLY_LOCK_TTL = 23 * 60 * 60 * 1000; // 23시간
const MONTHLY_LOCK_TTL = 23 * 60 * 60 * 1000; // 23시간

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/**
 * AI 리포트 생성 크론 작업 (Dispatcher)
 *
 * - 주간 리포트: 매주 일요일 UTC 22:00 (KST 월요일 07:00)
 * - 월간 리포트: 매월 1일 UTC 22:00 (KST 2일 07:00)
 *
 * 크론이 유저 목록을 조회하여 BullMQ 큐에 per-user 잡을 등록합니다.
 * 실제 처리는 ReportGenerationProcessor가 담당합니다.
 * 분산 락으로 중복 등록을 방지합니다.
 */
@Injectable()
export class ReportGenerationJob implements OnModuleInit {
	readonly #logger = new Logger(ReportGenerationJob.name);

	constructor(
		private readonly database: DatabaseService,
		@InjectQueue(AI_REPORT_QUEUE)
		private readonly queue: Queue<AiReportJobData>,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 서버 시작 시 누락된 크론 catch-up
	 *
	 * 안전: 분산 락 + BullMQ jobId + DB exists() 체크로 중복 방지
	 */
	async onModuleInit(): Promise<void> {
		await this.handleWeeklyReport();
		await this.handleMonthlyReport();
	}

	/**
	 * 주간 리포트 생성 — 매주 일요일 UTC 22:00
	 */
	@Cron("0 22 * * 0")
	async handleWeeklyReport(): Promise<void> {
		this.#logger.log("Starting weekly report generation job...");

		const release = await this.lockProvider.acquire(
			"report-weekly",
			WEEKLY_LOCK_TTL,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping weekly report — another instance holds the lock",
			);
			return;
		}

		try {
			await this.#enqueueReports("WEEKLY");
		} catch (error) {
			this.#logger.error(
				`Weekly report generation job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	/**
	 * 월간 리포트 생성 — 매월 1일 UTC 22:00 (KST 2일 07:00)
	 *
	 * 전월 데이터를 기반으로 리포트를 생성합니다.
	 */
	@Cron("0 22 1 * *")
	async handleMonthlyReport(): Promise<void> {
		this.#logger.log("Starting monthly report generation job...");

		const release = await this.lockProvider.acquire(
			"report-monthly",
			MONTHLY_LOCK_TTL,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping monthly report — another instance holds the lock",
			);
			return;
		}

		try {
			await this.#enqueueReports("MONTHLY");
		} catch (error) {
			this.#logger.error(
				`Monthly report generation job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	/**
	 * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
	 */
	async #enqueueReports(type: "WEEKLY" | "MONTHLY"): Promise<void> {
		const periodId = this.#getJobDeduplicationId();
		let totalEnqueued = 0;

		await forEachBatch({
			batchSize: ENQUEUE_BATCH_SIZE,
			fetchPage: (cursor, take) =>
				this.database.user.findMany({
					where: {
						...(cursor && { id: { gt: cursor } }),
						OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
					},
					select: {
						id: true,
						preference: {
							select: { timezone: true },
						},
					},
					orderBy: { id: "asc" },
					take,
				}),
			onBatch: async (batch) => {
				const jobs = batch.map((user) => ({
					name: "generate-report",
					data: {
						userId: user.id,
						timezone: user.preference?.timezone ?? "Asia/Seoul",
						reportType: type,
					} satisfies AiReportJobData,
					opts: {
						jobId: `report:${type}:${user.id}:${periodId}`,
						attempts: 3,
						backoff: { type: "exponential" as const, delay: 5_000 },
						removeOnComplete: { age: 604_800 },
						removeOnFail: 100,
					},
				}));

				await this.queue.addBulk(jobs);
				totalEnqueued += jobs.length;
			},
		});

		this.#logger.log(`${type} report jobs enqueued: total=${totalEnqueued}`);
	}

	/**
	 * jobId 중복 방지용 식별자 생성
	 *
	 * 같은 주/월에 동일 사용자에 대해 중복 잡 등록을 방지합니다.
	 * ISO 주번호 기반: "2026-W10" 형식
	 */
	#getJobDeduplicationId(): string {
		const now = new Date();
		const year = now.getFullYear();
		const jan1 = new Date(year, 0, 1);
		const days = Math.floor(
			(now.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000),
		);
		const weekNumber = Math.ceil((days + jan1.getDay() + 1) / 7);
		return `${year}-W${String(weekNumber).padStart(2, "0")}`;
	}
}

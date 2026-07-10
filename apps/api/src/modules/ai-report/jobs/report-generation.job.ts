import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Job, Queue } from "bullmq";
import dayjs from "dayjs";
import { AI_PER_USER_JOB_OPTS } from "@/common/bullmq/job-options";
import { runInBackground } from "@/common/bullmq/non-blocking-init";
import { forEachBatch } from "@/common/database";
import { toIsoMonthId, toIsoWeekId } from "@/common/date/utils/format";
import type { DatabaseService } from "@/database/database.service";
import {
	AI_REPORT_QUEUE,
	type AiReportGenerateData,
	type AiReportJobData,
	AiReportJobName,
	ReportGenerationProcessor,
} from "../processors/report-generation.processor";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

/** 크론 스케줄 + jobId 계산에 사용하는 기준 타임존 */
const CRON_TZ = "Asia/Seoul";

/**
 * AI 리포트 생성 스케줄러 (Dispatcher)
 *
 * - 주간 리포트: 매주 월요일 KST 01:00
 * - 월간 리포트: 매월 1일 KST 01:00
 *
 * BullMQ Job Scheduler를 사용하여 Redis에 스케줄을 저장합니다.
 * 서버 재시작 시에도 스케줄이 유지됩니다.
 */
@Injectable()
export class ReportGenerationJob implements OnModuleInit {
	readonly #logger = new Logger(ReportGenerationJob.name);

	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		@InjectQueue(AI_REPORT_QUEUE)
		private readonly queue: Queue<AiReportJobData>,
		private readonly processor: ReportGenerationProcessor,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) — CLS로 전파됩니다 */
	private get database() {
		return this.txHost.tx;
	}

	/** 스케줄러 등록 완료 프로미스 (테스트 대기용) — 부팅을 블로킹하지 않는다 */
	schedulerRegistration: Promise<void> = Promise.resolve();

	onModuleInit(): void {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setReportJob(this);

		// Redis 다운 중에도 부팅은 진행 — 오프라인 큐가 재연결 시 등록을 완료한다
		this.schedulerRegistration = runInBackground(
			this.#logger,
			"Report generation scheduler registration",
			async () => {
				await this.queue.upsertJobScheduler(
					"weekly-report-scheduler",
					{ pattern: "0 1 * * 1", tz: CRON_TZ },
					{
						name: AiReportJobName.DISPATCH,
						data: { reportType: "WEEKLY" } satisfies AiReportJobData,
					},
				);
				await this.queue.upsertJobScheduler(
					"monthly-report-scheduler",
					{ pattern: "0 2 1 * *", tz: CRON_TZ },
					{
						name: AiReportJobName.DISPATCH,
						data: { reportType: "MONTHLY" } satisfies AiReportJobData,
					},
				);

				this.#logger.log("Report generation schedulers registered");

				await this.#catchUpIfNeeded();
			},
		);
	}

	/**
	 * 대상 사용자를 조회하여 BullMQ 큐에 per-user 잡 등록
	 */
	async dispatchReports(
		type: "WEEKLY" | "MONTHLY",
		dispatchJob?: Job,
	): Promise<void> {
		this.#logger.log(`Starting ${type} report dispatch...`);

		const periodId = this.#getJobDeduplicationId(type);
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
							select: { timezone: true, locale: true },
						},
					},
					orderBy: { id: "asc" },
					take,
				}),
			onBatch: async (batch) => {
				const jobs = batch.map((user) => ({
					name: AiReportJobName.GENERATE,
					data: {
						userId: user.id,
						timezone: user.preference?.timezone ?? "Asia/Seoul",
						locale: user.preference?.locale ?? "ko",
						reportType: type,
					} satisfies AiReportGenerateData,
					opts: {
						...AI_PER_USER_JOB_OPTS,
						jobId: `report_${type}_${user.id}_${periodId}`,
					},
				}));

				await this.queue.addBulk(jobs);
				totalEnqueued += jobs.length;
				await dispatchJob?.updateProgress({ enqueued: totalEnqueued });
			},
		});

		this.#logger.log(`${type} report jobs enqueued: total=${totalEnqueued}`);
	}

	/**
	 * 서버 재시작 시 놓친 크론 스케줄을 보정합니다.
	 *
	 * 현재 KST 시각이 크론 트리거 윈도우 내에 있으면 dispatch 잡을 큐에 추가합니다.
	 * 멱등성이 보장되므로 (BullMQ jobId + DB exists) 중복 실행 위험 없음.
	 */
	async #catchUpIfNeeded(): Promise<void> {
		const kstNow = dayjs().tz(CRON_TZ);
		const dayOfWeek = kstNow.day(); // 0=일, 1=월, ...
		const dayOfMonth = kstNow.date();
		const hour = kstNow.hour();
		const now = kstNow.toDate();

		// 주간: 월요일 01:00 이후
		if (dayOfWeek === 1 && hour >= 1) {
			const weekId = toIsoWeekId(now, CRON_TZ);
			this.#logger.log("Catch-up: WEEKLY report dispatch");
			await this.queue.add(
				AiReportJobName.DISPATCH,
				{ reportType: "WEEKLY" } satisfies AiReportJobData,
				{ jobId: `dispatch_WEEKLY_${weekId}` },
			);
		}

		// 월간: 1일 01:00 이후
		if (dayOfMonth === 1 && hour >= 1) {
			const monthId = toIsoMonthId(now, CRON_TZ);
			this.#logger.log("Catch-up: MONTHLY report dispatch");
			await this.queue.add(
				AiReportJobName.DISPATCH,
				{ reportType: "MONTHLY" } satisfies AiReportJobData,
				{ jobId: `dispatch_MONTHLY_${monthId}` },
			);
		}
	}

	/**
	 * jobId 중복 방지용 기간 식별자 생성 (KST 기준)
	 *
	 * 크론 스케줄과 동일한 타임존으로 주차/월을 계산하여
	 * UTC ↔ KST 날짜 경계 불일치로 인한 jobId 충돌을 방지합니다.
	 */
	#getJobDeduplicationId(type: "WEEKLY" | "MONTHLY"): string {
		const now = new Date();
		return type === "WEEKLY"
			? toIsoWeekId(now, CRON_TZ)
			: toIsoMonthId(now, CRON_TZ);
	}
}

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { AI_PER_USER_JOB_OPTS } from "@/common/bullmq/job-options";
import { forEachBatch } from "@/common/database";
import { toIsoMonthId, toIsoWeekId } from "@/common/date/utils/format";
import { DatabaseService } from "@/database/database.service";
import {
	AI_REPORT_QUEUE,
	type AiReportGenerateData,
	type AiReportJobData,
	AiReportJobName,
	ReportGenerationProcessor,
} from "../processors/report-generation.processor";

/** 잡 enqueue용 배치 크기 (API 호출 없이 큐 적재만 하므로 크게 설정) */
const ENQUEUE_BATCH_SIZE = 50;

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
		private readonly database: DatabaseService,
		@InjectQueue(AI_REPORT_QUEUE)
		private readonly queue: Queue<AiReportJobData>,
		private readonly processor: ReportGenerationProcessor,
	) {}

	async onModuleInit(): Promise<void> {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setReportJob(this);

		await this.queue.upsertJobScheduler(
			"weekly-report-scheduler",
			{ pattern: "0 1 * * 1", tz: "Asia/Seoul" },
			{
				name: AiReportJobName.DISPATCH,
				data: { reportType: "WEEKLY" } satisfies AiReportJobData,
			},
		);
		await this.queue.upsertJobScheduler(
			"monthly-report-scheduler",
			{ pattern: "0 1 1 * *", tz: "Asia/Seoul" },
			{
				name: AiReportJobName.DISPATCH,
				data: { reportType: "MONTHLY" } satisfies AiReportJobData,
			},
		);

		this.#logger.log("Report generation schedulers registered");
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
							select: { timezone: true },
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
	 * jobId 중복 방지용 기간 식별자 생성
	 *
	 * 같은 주/월에 동일 사용자에 대해 중복 잡 등록을 방지합니다.
	 * - WEEKLY: ISO 주번호 기반 "2026-W10"
	 * - MONTHLY: 월 기반 "2026-M03"
	 */
	#getJobDeduplicationId(type: "WEEKLY" | "MONTHLY"): string {
		return type === "WEEKLY" ? toIsoWeekId() : toIsoMonthId();
	}
}

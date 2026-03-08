import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { AiReportService } from "../ai-report.service";
import type { ReportGenerationJob } from "../jobs/report-generation.job";

export const AI_REPORT_QUEUE = "ai-report-generation";

/** 잡 이름 상수 */
export const AiReportJobName = {
	DISPATCH: "dispatch-reports",
	GENERATE: "generate-report",
} as const;

/** 스케줄러가 생성하는 dispatch 트리거 잡 데이터 */
export interface AiReportDispatchData {
	reportType: "WEEKLY" | "MONTHLY";
}

/** per-user 리포트 생성 잡 데이터 */
export interface AiReportGenerateData {
	userId: string;
	timezone: string;
	reportType: "WEEKLY" | "MONTHLY";
}

/** 잡 이름 → 데이터 타입 매핑 */
export interface AiReportJobMap {
	[AiReportJobName.DISPATCH]: AiReportDispatchData;
	[AiReportJobName.GENERATE]: AiReportGenerateData;
}

export type AiReportJobData = AiReportJobMap[keyof AiReportJobMap];

/**
 * AI 리포트 생성 BullMQ 프로세서
 *
 * - dispatch-reports: 스케줄러 트리거 → per-user 잡 등록 (ReportGenerationJob.dispatchReports)
 * - generate-report: 단일 사용자 리포트 생성
 * - BullMQ 자동 재시도 (3회, exponential backoff)
 * - concurrency=5로 Gemini API rate limit 대응
 *
 * 알림 발송은 Scheduler Strategy (WeeklyReportStrategy / MonthlyReportStrategy)에서 담당합니다.
 */
@Processor(AI_REPORT_QUEUE, {
	concurrency: 5,
	lockDuration: 60_000,
	stalledInterval: 60_000,
})
export class ReportGenerationProcessor extends WorkerHost {
	readonly #logger = new Logger(ReportGenerationProcessor.name);

	/** @see ReportGenerationJob — 순환 참조 방지를 위해 setter injection */
	#reportJob!: ReportGenerationJob;
	setReportJob(job: ReportGenerationJob) {
		this.#reportJob = job;
	}

	constructor(private readonly aiReportService: AiReportService) {
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

	async process(job: Job<AiReportJobData>): Promise<void> {
		if (job.name === AiReportJobName.DISPATCH) {
			const { reportType } =
				job.data as AiReportJobMap[typeof AiReportJobName.DISPATCH];
			await this.#reportJob.dispatchReports(reportType, job);
			return;
		}

		if (job.name !== AiReportJobName.GENERATE) {
			this.#logger.warn(`Unknown job name: ${job.name}`);
			return;
		}

		const { userId, timezone, reportType } =
			job.data as AiReportJobMap[typeof AiReportJobName.GENERATE];

		this.#logger.debug(`Processing ${reportType} report: userId=${userId}`);

		const report =
			reportType === "WEEKLY"
				? await this.aiReportService.generateWeeklyReport(userId, timezone)
				: await this.aiReportService.generateMonthlyReport(userId, timezone);

		if (!report) {
			this.#logger.debug(
				`Report skipped (insufficient data): userId=${userId}, type=${reportType}`,
			);
			return;
		}

		this.#logger.log(`${reportType} report generated: userId=${userId}`);
	}
}

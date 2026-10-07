import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { toSupportedLocale } from "#api/platform/http/decorators/index";
import { fromLegacyJob, type NamedJob } from "#api/platform/jobs/named-job";
import {
  JOB_RUNTIME,
  type JobData,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";

import { GenerateReport } from "../../../application/use-cases/reports/generate-report.use-case.js";
import type { ReportDispatcher } from "../../jobs/reports/ai-report-queue.js";
import {
  AI_REPORT_LEGACY_QUEUE,
  AI_REPORT_QUEUE,
  AI_REPORT_WORKER_POLICY,
  type AiReportJobMap,
  AiReportJobName,
  AiReportRuntimeJobSchema,
} from "../../jobs/reports/ai-report-queue.js";

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
type AiReportJob = NamedJob<AiReportJobMap>;
type AiReportJobLike = { readonly name: string; readonly data: JobData };

@Injectable()
export class ReportGenerationProcessor implements OnModuleInit {
  readonly #logger = new Logger(ReportGenerationProcessor.name);

  #reportJob?: ReportDispatcher;
  setReportJob(job: ReportDispatcher) {
    this.#reportJob = job;
  }

  constructor(
    private readonly generateReportUseCase: GenerateReport,
    @Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) return;
    await this.runtime.work<AiReportJob>(
      AI_REPORT_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.data);
      },
      AI_REPORT_WORKER_POLICY,
    );
    await this.runtime.work<JobData>(
      AI_REPORT_LEGACY_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(fromLegacyJob<AiReportJobMap>(job));
      },
      AI_REPORT_WORKER_POLICY,
    );
  }

  onStalled(jobId: string): void {
    this.#logger.warn(`Job stalled: jobId=${jobId}`);
  }

  onError(error: Error): void {
    this.#logger.error(`Worker error: ${error.message}`, error.stack);
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, error: Error) {
    this.#logger.error(
      `Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
      error.stack,
    );
  }

  async process(untrustedJob: AiReportJobLike): Promise<void> {
    const parsedJob = AiReportRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn(`Invalid AI report job: name=${untrustedJob.name}`);
      return;
    }
    const job = parsedJob.data;
    if (job.name === AiReportJobName.DISPATCH) {
      await this.#reportJob?.dispatchReports(job.data.reportType);
      return;
    }

    const { userId, timezone, locale, reportType } = job.data;
    const reportLocale = toSupportedLocale(locale);

    this.#logger.debug(`Processing ${reportType} report: userId=${userId}`);

    const report = await this.generateReportUseCase.execute({
      userId,
      timezone,
      type: reportType,
      locale: reportLocale,
    });

    if (!report) {
      this.#logger.debug(
        `Report skipped (insufficient data): userId=${userId}, type=${reportType}`,
      );
      return;
    }

    this.#logger.log(`${reportType} report generated: userId=${userId}`);
  }
}

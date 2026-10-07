import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { fromLegacyJob, type NamedJob } from "#api/platform/jobs/named-job";
import {
  JOB_RUNTIME,
  type JobData,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";
import { toSupportedLocale } from "#api/shared/domain/locale";

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
import { AiJobLogEvent } from "../../observability/jobs/ai-job-log.events.js";

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
    @Inject(GenerateReport) private readonly generateReport: Pick<GenerateReport, "execute">,
    @Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.runtime === undefined) return;
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
    this.#logger.warn({ event: AiJobLogEvent.STALLED, queueName: AI_REPORT_QUEUE, jobId });
  }

  onError(_error: Error): void {
    this.#logger.error({
      event: AiJobLogEvent.WORKER_FAILED,
      queueName: AI_REPORT_QUEUE,
      errorType: "Error",
    });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, _error: Error) {
    this.#logger.error({
      event: AiJobLogEvent.FAILED,
      queueName: AI_REPORT_QUEUE,
      jobId: job?.id,
      errorType: "Error",
    });
  }

  async process(untrustedJob: AiReportJobLike): Promise<void> {
    const parsedJob = AiReportRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: AiJobLogEvent.INVALID, queueName: AI_REPORT_QUEUE });
      return;
    }
    const job = parsedJob.data;
    if (job.name === AiReportJobName.DISPATCH) {
      await this.#reportJob?.dispatchReports(job.data.reportType);
      return;
    }

    const { userId, timezone, locale, reportType } = job.data;
    const reportLocale = toSupportedLocale(locale);

    this.#logger.debug({
      event: AiJobLogEvent.STARTED,
      queueName: AI_REPORT_QUEUE,
      userId,
      reportType,
    });

    const report = await this.generateReport.execute({
      userId,
      timezone,
      type: reportType,
      locale: reportLocale,
    });

    if (report === null) {
      this.#logger.debug({
        event: AiJobLogEvent.SKIPPED,
        queueName: AI_REPORT_QUEUE,
        userId,
        reportType,
      });
      return;
    }

    this.#logger.log({
      event: AiJobLogEvent.COMPLETED,
      queueName: AI_REPORT_QUEUE,
      userId,
      reportType,
    });
  }
}

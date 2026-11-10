import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { toSupportedLocale } from "#api/shared/domain/locale";

import { GenerateReportUseCase } from "../../application/use-cases/generate-report.use-case.js";
import { AiJobLogEvent } from "./ai-job.log-events.js";
import type { ReportDispatcher } from "./ai-report.queue.js";
import {
  AI_REPORT_QUEUE,
  AI_REPORT_WORKER_POLICY,
  AiReportJobName,
  AiReportRuntimeJobSchema,
  isFinalReportAttempt,
} from "./ai-report.queue.js";

@Injectable()
export class ReportGenerationProcessor implements OnModuleInit {
  readonly #logger = new Logger(ReportGenerationProcessor.name);

  #reportJob?: ReportDispatcher;
  setReportJob(job: ReportDispatcher) {
    this.#reportJob = job;
  }

  readonly #generateReport: Pick<GenerateReportUseCase, "execute">;
  readonly #runtime: JobRuntimePort | undefined;

  constructor(
    @Inject(GenerateReportUseCase) generateReport: Pick<GenerateReportUseCase, "execute">,
    @Optional() runtime?: JobRuntimePort,
  ) {
    this.#generateReport = generateReport;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    if (this.#runtime == null) {
      return;
    }
    await this.#runtime.work(
      AI_REPORT_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data, job.attempt);
        }
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

  /** attempt는 1부터 센다. 생략하면 재시도 없는 단발 실행으로 보고 폴백까지 저장한다. */
  async process(untrustedJob: unknown, attempt = Number.POSITIVE_INFINITY): Promise<void> {
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

    const report = await this.#generateReport.execute({
      userId,
      timezone,
      type: reportType,
      locale: reportLocale,
      isFinalAttempt: isFinalReportAttempt(attempt),
    });

    if (report == null) {
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

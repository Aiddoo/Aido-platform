import { resolveSupportedLocale } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { AiGenerationLogEvent } from "../../../ai-generations/application/ai-generations.log-events.js";
import { GenerateReportUseCase } from "../../application/use-cases/generate-report.use-case.js";
import {
  AI_REPORT_QUEUE,
  AiReportJobName,
  type AiReportRuntimeJob,
  isFinalReportAttempt,
  type ReportDispatcher,
} from "./ai-report.queue.js";

@Injectable()
export class ReportGenerationProcessor implements OnModuleInit {
  readonly #logger = new Logger(ReportGenerationProcessor.name);

  #reportJob?: ReportDispatcher;

  readonly #generateReport: Pick<GenerateReportUseCase, "execute">;
  readonly #clock: ClockPort;
  readonly #jobQueue: Pick<JobQueuePort, "work"> | undefined;

  constructor(
    @Inject(GenerateReportUseCase) generateReport: Pick<GenerateReportUseCase, "execute">,
    @Inject(ClockPort) clock: ClockPort,
    @Optional() jobQueue?: JobQueuePort,
  ) {
    this.#generateReport = generateReport;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  setReportJob(job: ReportDispatcher) {
    this.#reportJob = job;
  }

  async onModuleInit(): Promise<void> {
    if (this.#jobQueue == null) {
      return;
    }
    await this.#jobQueue.work(AI_REPORT_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data, job.attempt);
      }
    });
  }

  /** attempt는 1부터 센다. 생략하면 재시도 없는 단발 실행으로 보고 폴백까지 저장한다. */
  async process(job: AiReportRuntimeJob, attempt = Number.POSITIVE_INFINITY): Promise<void> {
    if (job.name === AiReportJobName.DISPATCH) {
      await this.#reportJob?.dispatchReports(job.data.reportType);
      return;
    }

    const { userId, timezone, locale, reportType } = job.data;
    const reportLocale = resolveSupportedLocale(locale);

    this.#logger.debug({
      event: AiGenerationLogEvent.JOB_STARTED,
      queueName: AI_REPORT_QUEUE.name,
      userId,
      reportType,
    });

    const startedAtMs = this.#clock.now().epochMilliseconds;
    const report = await this.#generateReport.execute({
      userId,
      timezone,
      type: reportType,
      locale: reportLocale,
      isFinalAttempt: isFinalReportAttempt(attempt),
    });

    if (report == null) {
      this.#logger.debug({
        event: AiGenerationLogEvent.JOB_SKIPPED,
        queueName: AI_REPORT_QUEUE.name,
        userId,
        reportType,
      });
      return;
    }

    this.#logger.log({
      event: AiGenerationLogEvent.JOB_COMPLETED,
      queueName: AI_REPORT_QUEUE.name,
      userId,
      reportType,
      durationMs: this.#clock.now().epochMilliseconds - startedAtMs,
    });
  }
}

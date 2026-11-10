import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { DispatchDailySignupSummaryUseCase } from "../../application/use-cases/dispatch-daily-signup-summary.use-case.js";
import { SendAdminNotificationUseCase } from "../../application/use-cases/send-admin-notification.use-case.js";
import { AdminNoticeInfraLogEvent } from "../admin-notices-infra.log-events.js";
import {
  ADMIN_NOTIFICATION_QUEUE,
  ADMIN_NOTIFICATION_WORKER_POLICY,
  AdminNotificationJobName,
  AdminNotificationRuntimeJobSchema,
} from "./admin-notification.queue.js";

/**
 * 관리자 알림 JobRuntime Processor (진입 어댑터).
 *
 * - dispatch-signup-summary: 스케줄러 트리거 → DispatchDailySignupSummaryUseCase
 * - send-notification: 관리자 알림 채널 발송 → SendAdminNotificationUseCase
 *
 */

@Injectable()
export class AdminNotificationProcessor implements OnModuleInit {
  readonly #logger = new Logger(AdminNotificationProcessor.name);

  readonly #sendAdminNotification: SendAdminNotificationUseCase;
  readonly #dispatchDailySummary: DispatchDailySignupSummaryUseCase;
  readonly #runtime?: JobRuntimePort;

  constructor(
    sendAdminNotification: SendAdminNotificationUseCase,
    dispatchDailySummary: DispatchDailySignupSummaryUseCase,
    @Optional()
    @Inject(JOB_RUNTIME)
    runtime?: JobRuntimePort,
  ) {
    this.#sendAdminNotification = sendAdminNotification;
    this.#dispatchDailySummary = dispatchDailySummary;
    this.#runtime = runtime;
  }

  onStalled(jobId: string) {
    this.#logger.warn({
      event: AdminNoticeInfraLogEvent.JOB_STALLED,
      queueName: ADMIN_NOTIFICATION_QUEUE,
      jobId,
    });
  }

  onError(_error: Error) {
    this.#logger.error({
      event: AdminNoticeInfraLogEvent.WORKER_FAILED,
      queueName: ADMIN_NOTIFICATION_QUEUE,
      errorType: "worker",
    });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, _error: Error) {
    this.#logger.error({
      event: AdminNoticeInfraLogEvent.JOB_FAILED,
      queueName: ADMIN_NOTIFICATION_QUEUE,
      jobId: job?.id,
      jobName:
        job?.name === AdminNotificationJobName.SEND ||
        job?.name === AdminNotificationJobName.DISPATCH_SUMMARY
          ? job.name
          : undefined,
      errorType: "job",
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.#runtime) {
      return;
    }
    await this.#runtime.work(
      ADMIN_NOTIFICATION_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data);
        }
      },
      ADMIN_NOTIFICATION_WORKER_POLICY,
    );
  }

  async process(untrustedJob: unknown): Promise<void> {
    const parsedJob = AdminNotificationRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({
        event: AdminNoticeInfraLogEvent.JOB_INVALID,
        queueName: ADMIN_NOTIFICATION_QUEUE,
      });
      return;
    }
    const job = parsedJob.data;
    if (job.name === AdminNotificationJobName.DISPATCH_SUMMARY) {
      await this.#dispatchDailySummary.execute();
      return;
    }

    const { channel, notice } = job.data;
    await this.#sendAdminNotification.execute(channel, notice);
  }
}

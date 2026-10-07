import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { fromLegacyJob, type NamedJob } from "#api/platform/jobs/named-job";
import {
  JOB_RUNTIME,
  type JobData,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";

import { DispatchDailySignupSummary } from "../../../application/use-cases/notifications/dispatch-daily-signup-summary.use-case.js";
import { SendAdminNotification } from "../../../application/use-cases/notifications/send-admin-notification.use-case.js";
import { AdminNotificationInfraEvent } from "../../observability/notifications/admin-notification-infra.events.js";
import {
  ADMIN_NOTIFICATION_LEGACY_QUEUE,
  ADMIN_NOTIFICATION_QUEUE,
  ADMIN_NOTIFICATION_WORKER_POLICY,
  type AdminNotificationJobData,
  type AdminNotificationJobMap,
  AdminNotificationJobName,
  AdminNotificationRuntimeJobSchema,
} from "./admin-notification-queue.constants.js";

/**
 * 관리자 알림 JobRuntime Processor (진입 어댑터).
 *
 * - dispatch-signup-summary: 스케줄러 트리거 → DispatchDailySignupSummary
 * - send-notification: Discord 웹훅 발송 → SendAdminNotification
 *
 */
type AdminNotificationJob = NamedJob<AdminNotificationJobMap>;
interface AdminNotificationJobLike {
  readonly name: string;
  readonly data: AdminNotificationJobData;
}

@Injectable()
export class AdminNotificationProcessor implements OnModuleInit {
  readonly #logger = new Logger(AdminNotificationProcessor.name);

  constructor(
    private readonly sendAdminNotification: SendAdminNotification,
    private readonly dispatchDailySummary: DispatchDailySignupSummary,
    @Optional()
    @Inject(JOB_RUNTIME)
    private readonly runtime?: JobRuntimePort,
  ) {}

  onStalled(jobId: string) {
    this.#logger.warn({
      event: AdminNotificationInfraEvent.JOB_STALLED,
      queueName: ADMIN_NOTIFICATION_QUEUE,
      jobId,
    });
  }

  onError(_error: Error) {
    this.#logger.error({
      event: AdminNotificationInfraEvent.WORKER_FAILED,
      queueName: ADMIN_NOTIFICATION_QUEUE,
      errorType: "worker",
    });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, _error: Error) {
    this.#logger.error({
      event: AdminNotificationInfraEvent.JOB_FAILED,
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
    if (!this.runtime) return;
    await this.runtime.work<AdminNotificationJob>(
      ADMIN_NOTIFICATION_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.data);
      },
      ADMIN_NOTIFICATION_WORKER_POLICY,
    );
    await this.runtime.work<JobData>(
      ADMIN_NOTIFICATION_LEGACY_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(fromLegacyJob<AdminNotificationJobMap>(job));
        }
      },
      ADMIN_NOTIFICATION_WORKER_POLICY,
    );
  }

  async process(untrustedJob: AdminNotificationJobLike): Promise<void> {
    const parsedJob = AdminNotificationRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({
        event: AdminNotificationInfraEvent.JOB_INVALID,
        queueName: ADMIN_NOTIFICATION_QUEUE,
      });
      return;
    }
    const job = parsedJob.data;
    if (job.name === AdminNotificationJobName.DISPATCH_SUMMARY) {
      await this.dispatchDailySummary.execute();
      return;
    }

    const { channel, notification } = job.data;
    await this.sendAdminNotification.execute(channel, notification);
  }
}

import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { fromLegacyJob, type NamedJob } from "#api/platform/jobs/named-job";
import {
  JOB_RUNTIME,
  type JobData,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";

import { TimezoneAwareReminderOrchestrator } from "../../../application/services/reminders/timezone-aware-reminder.orchestrator.js";
import {
  TIMEZONE_REMINDER_LEGACY_QUEUE,
  TIMEZONE_REMINDER_QUEUE,
  TIMEZONE_REMINDER_WORKER_POLICY,
  type TimezoneReminderJobMap,
  TimezoneReminderJobName,
  TimezoneReminderRuntimeJobSchema,
} from "./timezone-reminder-queue.constants.js";

/**
 * 타임존 리마인더 BullMQ Processor (진입 어댑터).
 *
 * BullMQ Job Scheduler가 매분 생성하는 잡을 받아 오케스트레이터에 위임한다.
 * - sweep-reminders: 매분 스윕
 * - reminder-hour-changed: 리마인더 시간 변경 catch-up
 * - social-digest: 저녁 리마인더 90분 후 소셜 다이제스트
 *
 * 오케스트레이터를 생성자 주입하므로(무버스·무setter) DIP를 지키며,
 * 판별 유니온으로 job.data를 캐스트 없이 좁힌다.
 */
type TimezoneReminderJob = NamedJob<TimezoneReminderJobMap>;
type TimezoneReminderJobLike = {
  readonly name: string;
  readonly data: JobData;
};

import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";

@Injectable()
export class TimezoneReminderProcessor implements OnModuleInit {
  readonly #logger = new Logger(TimezoneReminderProcessor.name);

  constructor(
    private readonly orchestrator: TimezoneAwareReminderOrchestrator,
    @Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) return;
    await this.runtime.work<TimezoneReminderJob>(
      TIMEZONE_REMINDER_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.data);
      },
      TIMEZONE_REMINDER_WORKER_POLICY,
    );
    await this.runtime.work<JobData>(
      TIMEZONE_REMINDER_LEGACY_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(fromLegacyJob<TimezoneReminderJobMap>(job));
      },
      TIMEZONE_REMINDER_WORKER_POLICY,
    );
  }

  onStalled(jobId: string): void {
    this.#logger.warn({ event: NotificationProviderLogEvent.JOB_STALLED, jobId });
  }

  onError(_error: Error): void {
    this.#logger.error({ event: NotificationProviderLogEvent.WORKER_FAILED });
  }

  onFailed(job: { readonly id?: string; readonly name?: string } | undefined, _error: Error) {
    this.#logger.error({ event: NotificationProviderLogEvent.JOB_FAILED, jobId: job?.id });
  }

  async process(untrustedJob: TimezoneReminderJobLike): Promise<void> {
    const parsedJob = TimezoneReminderRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: NotificationProviderLogEvent.JOB_INVALID });
      return;
    }
    const job = parsedJob.data;
    switch (job.name) {
      case TimezoneReminderJobName.SWEEP_REMINDERS:
        this.#logger.debug({ event: NotificationProviderLogEvent.JOB_STARTED, jobName: job.name });
        await this.orchestrator.handleMinuteSweep();
        break;
      case TimezoneReminderJobName.REMINDER_HOUR_CHANGED:
        this.#logger.debug({
          event: NotificationProviderLogEvent.JOB_STARTED,
          jobName: job.name,
          userId: job.data.userId,
        });
        await this.orchestrator.handleReminderHourChanged(job.data);
        break;
      case TimezoneReminderJobName.SOCIAL_DIGEST:
        this.#logger.debug({ event: NotificationProviderLogEvent.JOB_STARTED, jobName: job.name });
        await this.orchestrator.handleSocialDigest(job.data);
        break;
      default: {
        const _exhaustive: never = job;
        void _exhaustive;
      }
    }
  }
}

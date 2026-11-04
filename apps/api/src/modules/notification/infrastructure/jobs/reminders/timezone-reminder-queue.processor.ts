import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";
import { match } from "ts-pattern";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { TimezoneAwareReminderOrchestrator } from "../../../application/services/reminders/timezone-aware-reminder.orchestrator.js";
import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";
/**
 * 타임존 리마인더 작업 Processor (진입 어댑터).
 *
 * 작업 스케줄러가 매분 생성하는 잡을 받아 오케스트레이터에 위임한다.
 * - sweep-reminders: 매분 스윕
 * - reminder-hour-changed: 리마인더 시간 변경 catch-up
 * - social-digest: 저녁 리마인더 90분 후 소셜 다이제스트
 *
 * 오케스트레이터를 생성자 주입하므로(무버스·무setter) DIP를 지키며,
 * 판별 유니온으로 job.data를 캐스트 없이 좁힌다.
 */
import {
  TIMEZONE_REMINDER_QUEUE,
  TIMEZONE_REMINDER_WORKER_POLICY,
  TimezoneReminderJobName,
  TimezoneReminderRuntimeJobSchema,
} from "./timezone-reminder-queue.constants.js";

@Injectable()
export class TimezoneReminderProcessor implements OnModuleInit {
  readonly #logger = new Logger(TimezoneReminderProcessor.name);

  constructor(
    private readonly orchestrator: TimezoneAwareReminderOrchestrator,
    @Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) {
      return;
    }
    await this.runtime.work(
      TIMEZONE_REMINDER_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data);
        }
      },
      TIMEZONE_REMINDER_WORKER_POLICY,
    );
  }

  async process(untrustedJob: unknown): Promise<void> {
    const parsedJob = TimezoneReminderRuntimeJobSchema.safeParse(untrustedJob);
    if (!parsedJob.success) {
      this.#logger.warn({ event: NotificationProviderLogEvent.JOB_INVALID });
      return;
    }
    const job = parsedJob.data;
    await match(job)
      .with({ name: TimezoneReminderJobName.SWEEP_REMINDERS }, async ({ name }) => {
        this.#logger.debug({ event: NotificationProviderLogEvent.JOB_STARTED, jobName: name });
        await this.orchestrator.handleMinuteSweep();
      })
      .with({ name: TimezoneReminderJobName.REMINDER_HOUR_CHANGED }, async ({ name, data }) => {
        this.#logger.debug({
          event: NotificationProviderLogEvent.JOB_STARTED,
          jobName: name,
          userId: data.userId,
        });
        await this.orchestrator.handleReminderHourChanged(data);
      })
      .with({ name: TimezoneReminderJobName.SOCIAL_DIGEST }, async ({ name, data }) => {
        this.#logger.debug({ event: NotificationProviderLogEvent.JOB_STARTED, jobName: name });
        await this.orchestrator.handleSocialDigest(data);
      })
      .exhaustive();
  }
}

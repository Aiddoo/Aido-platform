import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import {
  JOB_RUNTIME,
  type JobEnvelope,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import { ExpireStaleRedemptions } from "../../../application/use-cases/invites/expire-stale-redemptions.use-case.js";
import { ScheduleInviteQualifyReminders } from "../../../application/use-cases/invites/schedule-invite-qualify-reminders.use-case.js";
import { SendInviteQualifyReminder } from "../../../application/use-cases/invites/send-invite-qualify-reminder.use-case.js";
import {
  INVITE_MAINTENANCE_JOB_OPTIONS,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_MAINTENANCE_SCHEDULE,
  INVITE_QUALIFY_REMINDER_JOB_NAME,
  inviteMaintenanceJobPayloadSchema,
} from "./invite-reward-queue.constants.js";

@Injectable()
export class InviteMaintenanceProcessor implements OnModuleInit {
  constructor(
    @Inject(ExpireStaleRedemptions)
    private readonly expireStaleRedemptions: Pick<ExpireStaleRedemptions, "execute">,
    @Inject(ScheduleInviteQualifyReminders)
    private readonly scheduleQualifyReminders: Pick<ScheduleInviteQualifyReminders, "execute">,
    @Inject(SendInviteQualifyReminder)
    private readonly sendQualifyReminder: Pick<SendInviteQualifyReminder, "execute">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work(
      INVITE_MAINTENANCE_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.handle(job);
      },
      {
        teamSize: 1,
        pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
        queuePolicy: INVITE_MAINTENANCE_JOB_OPTIONS,
      },
    );
  }

  /** 사용 시작 알림 작업이 아니면 모두 정비 실행이다. 이미 등록된 일정·catch-up payload를 그대로 받는다. */
  async handle(job: Pick<JobEnvelope, "data">): Promise<void> {
    const payload = inviteMaintenanceJobPayloadSchema.safeParse(job.data);
    if (payload.success && payload.data.name === INVITE_QUALIFY_REMINDER_JOB_NAME) {
      await this.sendQualifyReminder.execute({
        redemptionId: payload.data.data.redemptionId,
        now: now(),
      });
      return;
    }
    await this.process();
  }

  async process(): Promise<void> {
    const at = now();
    await this.expireStaleRedemptions.execute({
      now: at,
      runDate: dayWindowInTimezone(at, INVITE_MAINTENANCE_SCHEDULE.timezone).localDate,
    });
    await this.scheduleQualifyReminders.execute({ now: at });
  }
}

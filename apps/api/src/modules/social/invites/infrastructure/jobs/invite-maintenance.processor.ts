import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  JOB_POLLING_SECONDS,
  type JobEnvelope,
  JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";

import { ExpireStaleRedemptionsUseCase } from "../../application/use-cases/expire-stale-redemptions.use-case.js";
import { ScheduleInviteQualifyRemindersUseCase } from "../../application/use-cases/schedule-invite-qualify-reminders.use-case.js";
import { SendInviteQualifyReminderUseCase } from "../../application/use-cases/send-invite-qualify-reminder.use-case.js";
import {
  INVITE_MAINTENANCE_JOB_OPTIONS,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_MAINTENANCE_SCHEDULE,
  INVITE_QUALIFY_REMINDER_JOB_NAME,
  inviteMaintenanceJobPayloadSchema,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteMaintenanceProcessor implements OnModuleInit {
  readonly #expireStaleRedemptions: Pick<ExpireStaleRedemptionsUseCase, "execute">;
  readonly #scheduleQualifyReminders: Pick<ScheduleInviteQualifyRemindersUseCase, "execute">;
  readonly #sendQualifyReminder: Pick<SendInviteQualifyReminderUseCase, "execute">;
  readonly #runtime: Pick<JobRuntimePort, "work">;
  readonly #clock: ClockPort;

  // 대역으로 갈아 끼울 수 있게 UseCase를 클래스 토큰으로 받되 execute만 쓴다
  constructor(
    @Inject(ExpireStaleRedemptionsUseCase)
    expireStaleRedemptions: Pick<ExpireStaleRedemptionsUseCase, "execute">,
    @Inject(ScheduleInviteQualifyRemindersUseCase)
    scheduleQualifyReminders: Pick<ScheduleInviteQualifyRemindersUseCase, "execute">,
    @Inject(SendInviteQualifyReminderUseCase)
    sendQualifyReminder: Pick<SendInviteQualifyReminderUseCase, "execute">,
    runtime: JobRuntimePort,
    clock: ClockPort,
  ) {
    this.#expireStaleRedemptions = expireStaleRedemptions;
    this.#scheduleQualifyReminders = scheduleQualifyReminders;
    this.#sendQualifyReminder = sendQualifyReminder;
    this.#runtime = runtime;
    this.#clock = clock;
  }

  async onModuleInit(): Promise<void> {
    await this.#runtime.work(
      INVITE_MAINTENANCE_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.handle(job);
        }
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
      await this.#sendQualifyReminder.execute({
        redemptionId: payload.data.data.redemptionId,
        now: this.#clock.now(),
      });
      return;
    }
    await this.process();
  }

  async process(): Promise<void> {
    const now = this.#clock.now();
    await this.#expireStaleRedemptions.execute({
      now,
      runDate: localDateOf(now, TimeZone.create(INVITE_MAINTENANCE_SCHEDULE.timezone)),
    });
    await this.#scheduleQualifyReminders.execute({ now });
  }
}

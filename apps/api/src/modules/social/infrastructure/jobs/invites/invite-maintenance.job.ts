import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/bullmq/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone, toLocalTimeString } from "#api/shared/domain/date/utils/timezone";

import { SocialInviteLogEvent } from "../../../application/observability/invites/social-invite-log.events.js";
import {
  INVITE_MAINTENANCE_JOB_NAME,
  INVITE_MAINTENANCE_JOB_OPTIONS,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_MAINTENANCE_SCHEDULE,
  InviteMaintenanceJobKey,
} from "./invite-reward-queue.constants.js";

@Injectable()
export class InviteMaintenanceJob implements OnModuleInit {
  readonly #logger = new Logger(InviteMaintenanceJob.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Invite maintenance scheduler registration",
      async () => {
        await this.runtime.schedule(
          INVITE_MAINTENANCE_SCHEDULE.id,
          INVITE_MAINTENANCE_SCHEDULE.cron,
          INVITE_MAINTENANCE_QUEUE,
          { name: INVITE_MAINTENANCE_JOB_NAME, data: {} },
          INVITE_MAINTENANCE_JOB_OPTIONS,
        );
        this.#logger.log({ event: SocialInviteLogEvent.MAINTENANCE_SCHEDULER_REGISTERED });
        await this.#catchUpIfNeeded();
      },
    );
  }

  async #catchUpIfNeeded(): Promise<void> {
    // 프로세서와 같은 공용 날짜 유틸로 실행 날짜를 정해 catch-up 키와 재시도 날짜가 어긋나지 않게 한다
    const at = now();
    const { timezone, catchUpHour } = INVITE_MAINTENANCE_SCHEDULE;
    if (Number(toLocalTimeString(at, timezone).slice(0, 2)) < catchUpHour) return;

    const { localDate } = dayWindowInTimezone(at, timezone);
    await this.runtime.enqueue(
      INVITE_MAINTENANCE_QUEUE,
      { name: INVITE_MAINTENANCE_JOB_NAME, data: {} },
      {
        ...INVITE_MAINTENANCE_JOB_OPTIONS,
        idempotencyKey: InviteMaintenanceJobKey.catchUp(localDate),
      },
    );
    this.#logger.log({ event: SocialInviteLogEvent.MAINTENANCE_CATCH_UP_DISPATCHED, localDate });
  }
}

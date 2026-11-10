import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { InviteLogEvent } from "../../application/invites.log-events.js";
import {
  INVITE_MAINTENANCE_JOB_NAME,
  INVITE_MAINTENANCE_JOB_OPTIONS,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_MAINTENANCE_SCHEDULE,
  InviteMaintenanceJobKey,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteMaintenanceScheduler implements OnModuleInit {
  readonly #logger = new Logger(InviteMaintenanceScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #runtime: Pick<JobRuntimePort, "schedule" | "enqueue">;
  readonly #clock: ClockPort;

  constructor(runtime: JobRuntimePort, clock: ClockPort) {
    this.#runtime = runtime;
    this.#clock = clock;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Invite maintenance scheduler registration",
      async () => {
        await this.#runtime.schedule(
          INVITE_MAINTENANCE_SCHEDULE.id,
          INVITE_MAINTENANCE_SCHEDULE.cron,
          INVITE_MAINTENANCE_QUEUE,
          { name: INVITE_MAINTENANCE_JOB_NAME, data: {} },
          INVITE_MAINTENANCE_JOB_OPTIONS,
        );
        this.#logger.log({ event: InviteLogEvent.MAINTENANCE_SCHEDULER_REGISTERED });
        await this.#catchUpIfNeeded();
      },
    );
  }

  async #catchUpIfNeeded(): Promise<void> {
    // 프로세서와 같은 시간대로 실행 날짜를 정해 catch-up 키와 재시도 날짜가 어긋나지 않게 한다
    const { timezone, catchUpHour } = INVITE_MAINTENANCE_SCHEDULE;
    const local = this.#clock.now().toZonedDateTimeISO(TimeZone.create(timezone).value);
    if (local.hour < catchUpHour) {
      return;
    }

    const runDate = local.toPlainDate();
    await this.#runtime.enqueue(
      INVITE_MAINTENANCE_QUEUE,
      { name: INVITE_MAINTENANCE_JOB_NAME, data: {} },
      {
        ...INVITE_MAINTENANCE_JOB_OPTIONS,
        idempotencyKey: InviteMaintenanceJobKey.catchUp(runDate),
      },
    );
    this.#logger.log({
      event: InviteLogEvent.MAINTENANCE_CATCH_UP_DISPATCHED,
      localDate: runDate.toString(),
    });
  }
}

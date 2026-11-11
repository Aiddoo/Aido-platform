import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { InviteLogEvent } from "../../application/invites.log-events.js";
import {
  INVITE_MAINTENANCE_JOB_NAME,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_MAINTENANCE_SCHEDULE,
  InviteMaintenanceJobKey,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteMaintenanceScheduler implements OnModuleInit {
  readonly #logger = new Logger(InviteMaintenanceScheduler.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: Pick<JobQueuePort, "registerSchedules" | "enqueue">;
  readonly #clock: ClockPort;

  constructor(jobQueue: JobQueuePort, clock: ClockPort) {
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  onModuleInit(): void {
    // Queue 장애가 API 부팅을 막지 않도록 등록 완료를 백그라운드에서 기다린다
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Invite maintenance scheduler registration",
      async () => {
        await this.#jobQueue.registerSchedules(INVITE_MAINTENANCE_QUEUE);
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
    await this.#jobQueue.enqueue(
      INVITE_MAINTENANCE_QUEUE,
      { name: INVITE_MAINTENANCE_JOB_NAME },
      { idempotencyKey: InviteMaintenanceJobKey.catchUp(runDate) },
    );
    this.#logger.log({
      event: InviteLogEvent.MAINTENANCE_CATCH_UP_DISPATCHED,
      localDate: runDate.toString(),
    });
  }
}

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import { ExpireStaleRedemptions } from "../../../application/use-cases/invites/expire-stale-redemptions.use-case.js";
import {
  INVITE_MAINTENANCE_JOB_OPTIONS,
  INVITE_MAINTENANCE_QUEUE,
  INVITE_MAINTENANCE_SCHEDULE,
  type InviteMaintenanceJobData,
} from "./invite-reward-queue.constants.js";

@Injectable()
export class InviteMaintenanceProcessor implements OnModuleInit {
  constructor(
    @Inject(ExpireStaleRedemptions)
    private readonly expireStaleRedemptions: Pick<ExpireStaleRedemptions, "execute">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runtime.work<InviteMaintenanceJobData>(
      INVITE_MAINTENANCE_QUEUE,
      async () => this.process(),
      {
        teamSize: 1,
        pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
        queuePolicy: INVITE_MAINTENANCE_JOB_OPTIONS,
      },
    );
  }

  async process(): Promise<void> {
    const at = now();
    await this.expireStaleRedemptions.execute({
      now: at,
      runDate: dayWindowInTimezone(at, INVITE_MAINTENANCE_SCHEDULE.timezone).localDate,
    });
  }
}

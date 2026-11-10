import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  type EnqueueJobOptions,
  JOB_POLLING_SECONDS,
  JOB_RUNTIME,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PlatformLogEvent } from "../logging/platform.log-events.js";
import { USAGE_METER, type UsageMeterPort } from "./interfaces/usage-meter.interface.js";

export const USAGE_RETENTION_QUEUE = "outbound-usage-retention.v1";
/** 월 예산·공급자 월 한도를 넘는 기간만 남긴다. */
const USAGE_RETENTION_DAYS = 90;

const USAGE_RETENTION_SCHEDULE = {
  id: "daily-outbound-usage-retention",
  cron: "30 4 * * *",
  timezone: "Asia/Seoul",
} as const;

const USAGE_RETENTION_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
  timezone: USAGE_RETENTION_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;

/** 오래된 외부 호출 사용량 기간을 하루 한 번 지운다. */
@Injectable()
export class UsageRetentionJob implements OnModuleInit {
  readonly #logger = new Logger(UsageRetentionJob.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #meter: Pick<UsageMeterPort, "prune">;
  readonly #runtime: JobRuntimePort;
  readonly #clock: ClockPort;

  constructor(
    @Inject(USAGE_METER) meter: Pick<UsageMeterPort, "prune">,
    @Inject(JOB_RUNTIME) runtime: JobRuntimePort,
    clock: ClockPort,
  ) {
    this.#meter = meter;
    this.#runtime = runtime;
    this.#clock = clock;
  }

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Outbound usage retention scheduler registration",
      async () => {
        await this.#runtime.work(USAGE_RETENTION_QUEUE, async () => this.prune(), {
          teamSize: 1,
          pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
          queuePolicy: USAGE_RETENTION_JOB_OPTIONS,
        });
        await this.#runtime.schedule(
          USAGE_RETENTION_SCHEDULE.id,
          USAGE_RETENTION_SCHEDULE.cron,
          USAGE_RETENTION_QUEUE,
          {},
          USAGE_RETENTION_JOB_OPTIONS,
        );
      },
    );
  }

  async prune(): Promise<void> {
    try {
      // UTC 일수라 일광 절약 없이 24시간 단위다
      const cutoff = this.#clock.now().subtract({ hours: 24 * USAGE_RETENTION_DAYS });
      const prunedCount = await this.#meter.prune(cutoff);
      this.#logger.log({ event: PlatformLogEvent.METERING_USAGE_PRUNED, prunedCount });
    } catch (error) {
      this.#logger.error({
        event: PlatformLogEvent.METERING_PRUNE_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}

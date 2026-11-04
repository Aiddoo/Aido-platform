import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import {
  type EnqueueJobOptions,
  JOB_POLLING_SECONDS,
  JOB_RUNTIME,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { AccessQuotaLogEvent } from "../../../application/observability/quotas/access-quota-log.events.js";
import { QuotaLedgerService } from "../../../application/services/quotas/quota-ledger.service.js";

export const QUOTA_ABANDONED_REFUND_QUEUE = "quota-abandoned-refund.v1";

const QUOTA_ABANDONED_REFUND_SCHEDULE = {
  id: "quota-abandoned-refund-scheduler",
  cron: "*/10 * * * *",
  timezone: "UTC",
} as const;

const QUOTA_ABANDONED_REFUND_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 30,
  retryBackoff: true,
  expireInSeconds: 9 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
  timezone: QUOTA_ABANDONED_REFUND_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;

/** 프로세스가 죽어 끝나지 못한 예약을 주기적으로 돌려준다. 주기는 환불 지연만 정한다. */
@Injectable()
export class QuotaAbandonedRefundJob implements OnModuleInit {
  readonly #logger = new Logger(QuotaAbandonedRefundJob.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(
    @Inject(QuotaLedgerService)
    private readonly ledger: Pick<QuotaLedgerService, "refundAbandonedReservations">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Quota abandoned refund scheduler registration",
      async () => {
        await this.runtime.work(QUOTA_ABANDONED_REFUND_QUEUE, async () => this.refund(), {
          teamSize: 1,
          pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
          queuePolicy: QUOTA_ABANDONED_REFUND_JOB_OPTIONS,
        });
        await this.runtime.schedule(
          QUOTA_ABANDONED_REFUND_SCHEDULE.id,
          QUOTA_ABANDONED_REFUND_SCHEDULE.cron,
          QUOTA_ABANDONED_REFUND_QUEUE,
          {},
          QUOTA_ABANDONED_REFUND_JOB_OPTIONS,
        );
      },
    );
  }

  async refund(): Promise<void> {
    try {
      await this.ledger.refundAbandonedReservations();
    } catch (error) {
      this.#logger.error({
        event: AccessQuotaLogEvent.ABANDONED_REFUND_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}

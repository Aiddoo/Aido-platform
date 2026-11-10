import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import {
  type EnqueueJobOptions,
  JOB_POLLING_SECONDS,
  JOB_RUNTIME,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { QuotaLogEvent } from "../../application/quotas.log-events.js";
import { QuotaLedgerAdapter } from "../adapters/quota-ledger.adapter.js";

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
export class QuotaAbandonedRefundProcessor implements OnModuleInit {
  readonly #logger = new Logger(QuotaAbandonedRefundProcessor.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #ledger: Pick<QuotaLedgerAdapter, "refundAbandonedReservations">;
  readonly #runtime: JobRuntimePort;

  constructor(
    @Inject(QuotaLedgerAdapter) ledger: Pick<QuotaLedgerAdapter, "refundAbandonedReservations">,
    @Inject(JOB_RUNTIME) runtime: JobRuntimePort,
  ) {
    this.#ledger = ledger;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    // 다른 잡처럼 worker 등록 실패는 기동을 멈춘다. 조용히 죽으면 RESERVED가 환불되지 않는다.
    await this.#runtime.work(QUOTA_ABANDONED_REFUND_QUEUE, async () => this.refund(), {
      teamSize: 1,
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
      queuePolicy: QUOTA_ABANDONED_REFUND_JOB_OPTIONS,
    });
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Quota abandoned refund scheduler registration",
      async () => {
        await this.#runtime.schedule(
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
      await this.#ledger.refundAbandonedReservations();
    } catch (error) {
      this.#logger.error({
        event: QuotaLogEvent.ABANDONED_REFUND_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}

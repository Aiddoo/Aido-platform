import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { QuotaLogEvent } from "../../application/quotas.log-events.js";
import { RefundAbandonedQuotaReservationsUseCase } from "../../application/use-cases/refund-abandoned-quota-reservations.use-case.js";
import { QUOTA_ABANDONED_REFUND_QUEUE } from "./quota-abandoned-refund.queue.js";

@Injectable()
export class QuotaAbandonedRefundProcessor implements OnModuleInit {
  readonly #logger = new Logger(QuotaAbandonedRefundProcessor.name);
  readonly #refundAbandonedReservations: Pick<RefundAbandonedQuotaReservationsUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    refundAbandonedReservations: RefundAbandonedQuotaReservationsUseCase,
    jobQueue: JobQueuePort,
  ) {
    this.#refundAbandonedReservations = refundAbandonedReservations;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    // 다른 잡처럼 worker 등록 실패는 기동을 멈춘다. 조용히 죽으면 RESERVED가 환불되지 않는다
    await this.#jobQueue.work(QUOTA_ABANDONED_REFUND_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    try {
      await this.#refundAbandonedReservations.execute();
    } catch (error) {
      this.#logger.error({
        event: QuotaLogEvent.ABANDONED_REFUND_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}

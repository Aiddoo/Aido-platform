import { uniq } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import type { NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type PushProvider } from "../../ports/delivery/push-provider.port.js";
import { type PushReceiptRepositoryPort } from "../../ports/delivery/push-receipt.repository.port.js";
import { type PushTokenRepositoryPort } from "../../ports/delivery/push-token.repository.port.js";

const PUSH_RECEIPT_BATCH_SIZE = 900;

interface ReconcilePushReceiptsDependencies {
  readonly pushReceiptRepository: Pick<
    PushReceiptRepositoryPort,
    "findPendingPushReceipts" | "recordPushReceipts"
  >;
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deactivateInvalidTokens">;
  readonly pushProvider: Pick<PushProvider, "getReceipts">;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
}

export class ReconcilePushReceipts {
  readonly #dependencies: ReconcilePushReceiptsDependencies;

  constructor(dependencies: ReconcilePushReceiptsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const pendingReceipts =
      await this.#dependencies.pushReceiptRepository.findPendingPushReceipts(
        PUSH_RECEIPT_BATCH_SIZE,
      );
    if (pendingReceipts.length === 0) return;

    const receipts = await this.#dependencies.pushProvider.getReceipts(
      pendingReceipts.map((attempt) => attempt.ticketId),
    );
    // 비활성화 실패 시 terminal receipt도 롤백되어 다음 실행에서 다시 처리할 수 있다.
    const invalidTokens = await this.#dependencies.unitOfWork.run(async () => {
      const invalid = await this.#dependencies.pushReceiptRepository.recordPushReceipts(receipts);
      if (invalid.length > 0) {
        await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(
          invalid.map(({ token }) => token),
        );
      }
      return invalid;
    });
    if (invalidTokens.length > 0) {
      const userIds = uniq(invalidTokens.map(({ userId }) => userId));
      const settled = await Promise.allSettled(
        userIds.map((userId) => this.#dependencies.cache.invalidatePushTokens(userId)),
      );
      const failedCount = settled.filter((result) => result.status === "rejected").length;
      if (failedCount > 0) {
        this.#dependencies.logger.warn({
          event: NotificationDeliveryLogEvent.RECONCILE_PUSH_RECEIPTS_CACHE_SETTLE_FAILED,
          count: failedCount,
          errorType: "cache-invalidation",
        });
      }
    }
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.RECONCILE_PUSH_RECEIPTS_RECONCILED,
      requested: pendingReceipts.length,
      received: receipts.length,
      invalidCount: invalidTokens.length,
    });
  }
}

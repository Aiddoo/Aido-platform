import { uniq } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import type { NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import {
  PUSH_RECEIPT_POLICY,
  pushReceiptCheckWindow,
} from "../../domain/push-receipt.domain-service.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { PushProvider } from "../ports/push-provider.port.js";
import type {
  InvalidPushToken,
  PushReceiptRepositoryPort,
} from "../ports/push-receipt.repository.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";

interface ReconcilePushReceiptsDependencies {
  readonly pushReceiptRepository: Pick<
    PushReceiptRepositoryPort,
    "expireUnreceipted" | "findPendingTicketIds" | "recordPushReceipts"
  >;
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deactivateInvalidTokens">;
  readonly pushProvider: Pick<PushProvider, "getReceipts">;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 실행 예산 안에서 확인할 ticket이 남지 않을 때까지 receipt를 이어서 반영한다. */
export class ReconcilePushReceipts {
  readonly #dependencies: ReconcilePushReceiptsDependencies;

  constructor(dependencies: ReconcilePushReceiptsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const startedAt = Date.now();
    const expired = await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.pushReceiptRepository.expireUnreceipted(
        pushReceiptCheckWindow(new Date(startedAt)).acceptedAfter,
        PUSH_RECEIPT_POLICY.expireBatchSize,
      ),
    );
    const totals = { requested: 0, received: 0, invalidCount: 0, batches: 0 };
    for (;;) {
      const ticketIds = await this.#dependencies.pushReceiptRepository.findPendingTicketIds(
        pushReceiptCheckWindow(new Date()),
        PUSH_RECEIPT_POLICY.batchSize,
      );
      if (ticketIds.length === 0) {
        break;
      }
      const received = await this.#reconcileBatch(ticketIds);
      totals.batches += 1;
      totals.requested += ticketIds.length;
      totals.received += received.received;
      totals.invalidCount += received.invalidCount;
      const hasMore = ticketIds.length === PUSH_RECEIPT_POLICY.batchSize;
      if (!hasMore || Date.now() - startedAt >= PUSH_RECEIPT_POLICY.runBudgetMs) {
        break;
      }
    }
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.RECONCILE_PUSH_RECEIPTS_RECONCILED,
      expired,
      ...totals,
    });
  }

  async #reconcileBatch(
    ticketIds: readonly string[],
  ): Promise<{ readonly received: number; readonly invalidCount: number }> {
    const receipts = await this.#dependencies.pushProvider.getReceipts(ticketIds);
    // 비활성화 실패 시 terminal receipt도 롤백되어 다음 실행에서 다시 처리할 수 있다.
    const invalidTokens = await this.#dependencies.unitOfWork.run(async () => {
      const invalid = await this.#dependencies.pushReceiptRepository.recordPushReceipts({
        requestedTicketIds: ticketIds,
        results: receipts,
        checkedAt: new Date(),
      });
      if (invalid.length > 0) {
        await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(
          invalid.map(({ token }) => token),
        );
      }
      return invalid;
    });
    await this.#settleTokenCache(invalidTokens);
    return { received: receipts.length, invalidCount: invalidTokens.length };
  }

  async #settleTokenCache(invalidTokens: readonly InvalidPushToken[]): Promise<void> {
    if (invalidTokens.length === 0) {
      return;
    }
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
}

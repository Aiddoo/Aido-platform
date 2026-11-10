import { uniq } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import {
  PUSH_RECEIPT_POLICY,
  pushReceiptCheckWindow,
} from "../../domain/push-receipt.domain-service.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { PushProviderPort } from "../ports/push-provider.port.js";
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
  readonly pushProvider: Pick<PushProviderPort, "getReceipts">;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

// 실행 예산 안에서 확인할 ticket이 남지 않을 때까지 receipt를 이어서 반영한다
export class ReconcilePushReceiptsUseCase {
  readonly #dependencies: ReconcilePushReceiptsDependencies;

  constructor(dependencies: ReconcilePushReceiptsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const startedAt = this.#dependencies.clock.now();
    const expired = await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.pushReceiptRepository.expireUnreceipted(
        pushReceiptCheckWindow(instantToDate(startedAt)).acceptedAfter,
        PUSH_RECEIPT_POLICY.expireBatchSize,
      ),
    );
    const totals = { requested: 0, received: 0, invalidCount: 0, batches: 0 };
    for (;;) {
      const ticketIds = await this.#dependencies.pushReceiptRepository.findPendingTicketIds(
        pushReceiptCheckWindow(this.#now()),
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
      const elapsedMs = this.#dependencies.clock.now().since(startedAt).total("milliseconds");
      if (!hasMore || elapsedMs >= PUSH_RECEIPT_POLICY.runBudgetMs) {
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
        checkedAt: this.#now(),
      });
      if (invalid.length > 0) {
        await this.#dependencies.pushTokenRepository.deactivateInvalidTokens(
          invalid.map(({ token }) => token),
          this.#dependencies.clock.now(),
        );
      }
      return invalid;
    });
    await this.#settleTokenCache(invalidTokens);
    return { received: receipts.length, invalidCount: invalidTokens.length };
  }

  #now(): Date {
    return instantToDate(this.#dependencies.clock.now());
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

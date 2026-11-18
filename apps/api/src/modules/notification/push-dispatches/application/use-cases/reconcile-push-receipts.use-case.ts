import { countBy, maxBy, uniqBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type {
  PushTokenCachePort,
  PushTokenRepositoryPort,
} from "../../../push-devices/notification-push-devices.public.js";
import { PUSH_CHANNELS } from "../../../shared/domain/push-channel.constants.js";
import {
  type PushFailureKind,
  revokesPushToken,
} from "../../domain/push-failure-kind.constants.js";
import {
  isReceiptFailureRatioHigh,
  PUSH_RECEIPT_POLICY,
  pushReceiptCheckWindow,
} from "../../domain/push-receipt.domain-service.js";
import type { PushTicketId } from "../../domain/push-ticket-id.vo.js";
import type { PushChannelRegistryPort } from "../ports/push-channel-registry.port.js";
import type { PushChannelPort } from "../ports/push-channel.port.js";
import type {
  InvalidPushToken,
  PushReceiptRepositoryPort,
} from "../ports/push-receipt.repository.port.js";
import { PushDispatchAlerts } from "../push-dispatches.alerts.js";
import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";

interface ReconcilePushReceiptsDependencies {
  readonly pushReceiptRepository: Pick<
    PushReceiptRepositoryPort,
    "expireUnreceipted" | "findPendingTicketIds" | "recordPushReceipts"
  >;
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deactivateInvalidTokens">;
  readonly channels: Pick<PushChannelRegistryPort, "forChannel">;
  readonly cache: Pick<PushTokenCachePort, "invalidatePushTokens">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
}

interface ReconcileRun {
  readonly startedAt: Temporal.Instant;
  readonly totals: {
    expired: number;
    requested: number;
    received: number;
    invalidCount: number;
    batches: number;
  };
  readonly providerFailures: PushFailureKind[];
}

// 채널마다 실행 예산 안에서 확인할 ticket이 남지 않을 때까지 receipt를 이어서 반영한다
export class ReconcilePushReceiptsUseCase {
  readonly #dependencies: ReconcilePushReceiptsDependencies;

  constructor(dependencies: ReconcilePushReceiptsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const run: ReconcileRun = {
      startedAt: this.#dependencies.clock.now(),
      totals: { expired: 0, requested: 0, received: 0, invalidCount: 0, batches: 0 },
      providerFailures: [],
    };
    for (const channel of PUSH_CHANNELS) {
      await this.#reconcileChannel(this.#dependencies.channels.forChannel(channel), run);
    }
    this.#dependencies.logger.log({
      event: PushDispatchLogEvent.RECONCILE_PUSH_RECEIPTS_RECONCILED,
      ...run.totals,
      providerFailureCount: run.providerFailures.length,
    });
    this.#alertIfProviderFailing(run.totals.received, run.providerFailures);
  }

  async #reconcileChannel(channel: PushChannelPort, run: ReconcileRun): Promise<void> {
    const receiptTiming = channel.timing.receipt;
    run.totals.expired += await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.pushReceiptRepository.expireUnreceipted({
        channel: channel.channel,
        acceptedBefore: pushReceiptCheckWindow(run.startedAt, receiptTiming).acceptedAfter,
        limit: PUSH_RECEIPT_POLICY.expireBatchSize,
      }),
    );
    for (;;) {
      const elapsedMs = this.#dependencies.clock.now().since(run.startedAt).total("milliseconds");
      if (elapsedMs >= PUSH_RECEIPT_POLICY.runBudgetMs) {
        return;
      }
      const ticketIds = await this.#dependencies.pushReceiptRepository.findPendingTicketIds({
        channel: channel.channel,
        window: pushReceiptCheckWindow(this.#dependencies.clock.now(), receiptTiming),
        limit: PUSH_RECEIPT_POLICY.batchSize,
      });
      if (ticketIds.length === 0) {
        return;
      }
      const received = await this.#reconcileBatch(channel, ticketIds);
      run.totals.batches += 1;
      run.totals.requested += ticketIds.length;
      run.totals.received += received.received;
      run.totals.invalidCount += received.invalidCount;
      run.providerFailures.push(...received.providerFailures);
      if (ticketIds.length < PUSH_RECEIPT_POLICY.batchSize) {
        return;
      }
    }
  }

  #alertIfProviderFailing(receivedCount: number, failures: readonly PushFailureKind[]): void {
    if (!isReceiptFailureRatioHigh({ receivedCount, providerFailureCount: failures.length })) {
      return;
    }
    const counts = Object.entries(countBy(failures, (kind) => kind));
    this.#dependencies.alert.raise({
      ...PushDispatchAlerts.RECEIPT_FAILURE_RATIO_HIGH,
      tags: { topFailureKind: maxBy(counts, ([, count]) => count)?.[0] ?? "UNKNOWN" },
      details: { receivedCount, providerFailureCount: failures.length },
    });
  }

  async #reconcileBatch(
    channel: Pick<PushChannelPort, "readReceipts">,
    ticketIds: readonly PushTicketId[],
  ): Promise<{
    readonly received: number;
    readonly invalidCount: number;
    readonly providerFailures: readonly PushFailureKind[];
  }> {
    const receipts = await channel.readReceipts(ticketIds);
    // 비활성화 실패 시 terminal receipt도 롤백되어 다음 실행에서 다시 처리할 수 있다.
    const invalidTokens = await this.#dependencies.unitOfWork.run(async () => {
      const invalid = await this.#dependencies.pushReceiptRepository.recordPushReceipts({
        requestedTicketIds: ticketIds,
        results: receipts,
        checkedAt: this.#dependencies.clock.now(),
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
    return {
      received: receipts.length,
      invalidCount: invalidTokens.length,
      providerFailures: receipts.flatMap((receipt) =>
        receipt.status === "failed" && !revokesPushToken(receipt.failure.kind)
          ? [receipt.failure.kind]
          : [],
      ),
    };
  }

  async #settleTokenCache(invalidTokens: readonly InvalidPushToken[]): Promise<void> {
    if (invalidTokens.length === 0) {
      return;
    }
    const userIds = uniqBy(
      invalidTokens.map(({ userId }) => userId),
      (userId) => userId.value,
    );
    const settled = await Promise.allSettled(
      userIds.map((userId) => this.#dependencies.cache.invalidatePushTokens(userId)),
    );
    const failedCount = settled.filter((result) => result.status === "rejected").length;
    if (failedCount > 0) {
      this.#dependencies.logger.warn({
        event: PushDispatchLogEvent.RECONCILE_PUSH_RECEIPTS_CACHE_SETTLE_FAILED,
        count: failedCount,
        errorType: "cache-invalidation",
      });
    }
  }
}

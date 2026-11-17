import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { FINISHED_PUSH_DISPATCH_RETENTION_DAYS } from "../../domain/push-delivery-history-retention.constants.js";
import type { PushDispatchStatus } from "../../domain/push-delivery-status.constants.js";
import { PUSH_RATE_LIMIT_POLICY } from "../../domain/push-rate-limit.constants.js";
import type { PushDeliveryHistoryRepositoryPort } from "../ports/push-delivery-history.repository.port.js";
import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";

const FINISHED_DISPATCH_STATUSES = [
  "SENT",
  "SKIPPED",
  "FAILED",
  "HOLDOUT",
] as const satisfies readonly PushDispatchStatus[];

interface PurgePushDeliveryHistoryCommand {
  // 이 순간이 지나면 남은 행은 다음 실행에 맡긴다
  readonly deadline: Temporal.Instant;
  readonly batchSize: number;
}

interface PurgePushDeliveryHistoryResult {
  readonly deletedReservations: number;
  readonly deletedDispatches: number;
  readonly completed: boolean;
}

interface PurgePushDeliveryHistoryDependencies {
  readonly history: Pick<
    PushDeliveryHistoryRepositoryPort,
    "deleteFinishedDispatches" | "deleteRateLimitReservations"
  >;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 한도 창이 끝난 예약과 보관 기간이 지난 끝난 발송을 묶음으로 지운다 */
export class PurgePushDeliveryHistoryUseCase {
  readonly #dependencies: PurgePushDeliveryHistoryDependencies;

  constructor(dependencies: PurgePushDeliveryHistoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: PurgePushDeliveryHistoryCommand): Promise<PurgePushDeliveryHistoryResult> {
    const now = this.#dependencies.clock.now();
    const reservations = await this.#purgeReservations(
      now.subtract({ milliseconds: PUSH_RATE_LIMIT_POLICY.ENGAGEMENT.RETENTION_MS }),
      command,
    );
    // UTC 일수라 일광 절약 없이 24시간 단위다
    const finishedBefore = now.subtract({ hours: 24 * FINISHED_PUSH_DISPATCH_RETENTION_DAYS });
    let deletedDispatches = 0;
    let dispatchesCompleted = reservations.completed;
    for (const status of FINISHED_DISPATCH_STATUSES) {
      if (!dispatchesCompleted) {
        break;
      }
      const purged = await this.#purgeDispatches(status, finishedBefore, command);
      deletedDispatches += purged.deletedCount;
      dispatchesCompleted = purged.completed;
    }

    const result = {
      deletedReservations: reservations.deletedCount,
      deletedDispatches,
      completed: dispatchesCompleted,
    };
    this.#dependencies.logger.log({
      event: PushDispatchLogEvent.PUSH_DELIVERY_HISTORY_PURGED,
      ...result,
    });
    return result;
  }

  async #purgeReservations(
    reservedBefore: Temporal.Instant,
    command: PurgePushDeliveryHistoryCommand,
  ): Promise<{ readonly deletedCount: number; readonly completed: boolean }> {
    let deletedCount = 0;
    while (this.#beforeDeadline(command.deadline)) {
      const deleted = await this.#dependencies.history.deleteRateLimitReservations({
        reservedBefore,
        limit: command.batchSize,
      });
      deletedCount += deleted;
      if (deleted < command.batchSize) {
        return { deletedCount, completed: true };
      }
    }
    return { deletedCount, completed: false };
  }

  async #purgeDispatches(
    status: PushDispatchStatus,
    finishedBefore: Temporal.Instant,
    command: PurgePushDeliveryHistoryCommand,
  ): Promise<{ readonly deletedCount: number; readonly completed: boolean }> {
    let deletedCount = 0;
    let scheduledFrom: Temporal.Instant | null = null;
    while (this.#beforeDeadline(command.deadline)) {
      const batch = await this.#dependencies.history.deleteFinishedDispatches({
        status,
        finishedBefore,
        scheduledFrom,
        limit: command.batchSize,
      });
      deletedCount += batch.deletedCount;
      if (batch.deletedCount < command.batchSize || batch.lastScheduledAt == null) {
        return { deletedCount, completed: true };
      }
      scheduledFrom = batch.lastScheduledAt;
    }
    return { deletedCount, completed: false };
  }

  #beforeDeadline(deadline: Temporal.Instant): boolean {
    return Temporal.Instant.compare(this.#dependencies.clock.now(), deadline) < 0;
  }
}

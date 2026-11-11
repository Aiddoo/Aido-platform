import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  addDaysToKey,
  localDateKeyAt,
} from "../../../shared/domain/todo-calendar.domain-service.js";
import { isSeriesOwnerDormant } from "../../domain/series-dormancy.domain-service.js";
import { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import type { TodoSeriesOwnerPort } from "../ports/todo-series-owner.port.js";
import type {
  TodoSeriesRef,
  TodoSeriesRepositoryPort,
} from "../ports/todo-series.repository.port.js";
import { TodoSeriesAlerts } from "../todo-series.alerts.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";
import type { MaterializeTodoSeriesUseCase } from "./materialize-todo-series.use-case.js";

const TODO_SERIES_MATERIALIZATION_BUDGET = {
  /** ID만 읽으므로 배치 메모리는 1MB 미만이다. */
  BATCH_SIZE: 100,
  /** 큐 만료(10분)보다 먼저 멈추고 남은 규칙은 다음 실행이 커서로 이어받는다. */
  DEADLINE_MS: 4 * 60 * 1000,
  /** UTC 오늘 + 91일이면 어떤 시간대의 오늘 + 90일도 포함한다. 시간대별 경계는 규칙마다 다시 잰다. */
  DUE_SCAN_AHEAD_DAYS: TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS + 1,
} as const;

export interface MaterializeDueTodoSeriesResult {
  readonly processedCount: number;
  readonly createdCount: number;
  readonly failedCount: number;
  readonly dormantCount: number;
  readonly timedOut: boolean;
}

interface MaterializeDueTodoSeriesDependencies {
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "findDueBatch">;
  readonly seriesOwner: TodoSeriesOwnerPort;
  readonly dueRunner: Pick<MaterializeTodoSeriesUseCase, "execute">;
  readonly alert: OperationalAlertPort;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
  readonly batchSize?: number;
  readonly deadlineMs?: number;
}

/**
 * 진행 중 규칙의 회차를 미리 만드는 기간까지 채운다.
 * pg-boss는 at-least-once라 다시 돌아도 안전해야 한다: 규칙 행을 SKIP LOCKED로 잡고,
 * (seriesId, occurrenceDate) 유니크로 건너뛰며, 커서는 만든 만큼만 앞으로 간다.
 * 소유자가 휴면이면 규칙을 건너뛰고 커서를 그대로 둔다. 돌아오면 복귀 경로나 다음 실행이 이어받는다.
 * 유료·ADMIN은 앱을 안 열어도 휴면으로 보지 않는다. 정지·탈퇴 대기 계정은 복구될 때까지 건너뛴다.
 */
export class MaterializeDueTodoSeriesUseCase {
  readonly #dependencies: MaterializeDueTodoSeriesDependencies;

  constructor(dependencies: MaterializeDueTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<MaterializeDueTodoSeriesResult> {
    const { logger, alert, seriesRepository, seriesOwner, dueRunner } = this.#dependencies;
    const batchSize = this.#dependencies.batchSize ?? TODO_SERIES_MATERIALIZATION_BUDGET.BATCH_SIZE;
    const deadlineMs =
      this.#dependencies.deadlineMs ?? TODO_SERIES_MATERIALIZATION_BUDGET.DEADLINE_MS;
    const startedAt = performance.now();
    const through = addDaysToKey(
      localDateKeyAt(this.#dependencies.clock.now(), "UTC"),
      TODO_SERIES_MATERIALIZATION_BUDGET.DUE_SCAN_AHEAD_DAYS,
    );
    let afterId: TodoSeriesId | null = null;
    let processedCount = 0;
    let createdCount = 0;
    let failedCount = 0;
    let dormantCount = 0;
    let timedOut = false;

    while (!timedOut) {
      const dueBatch: readonly TodoSeriesRef[] = await seriesRepository.findDueBatch({
        through,
        afterId,
        limit: batchSize,
      });
      const owners = await seriesOwner.findOperatingOwners(
        uniq(dueBatch.map(({ userId }) => userId)).map((userId) => UserId.reconstitute(userId)),
      );
      for (const due of dueBatch) {
        if (performance.now() - startedAt >= deadlineMs) {
          timedOut = true;
          break;
        }
        const owner = owners.get(due.userId);
        if (owner == null) {
          continue;
        }
        if (
          isSeriesOwnerDormant(owner, this.#dependencies.clock.now()) &&
          !(await seriesOwner.isExemptFromDormancy(UserId.reconstitute(due.userId)))
        ) {
          dormantCount += 1;
          continue;
        }
        processedCount += 1;
        try {
          // 사용자 수정이나 다른 실행이 규칙 행을 잡고 있으면 기다리지 않는다. 다음 실행이 커서로 이어받는다.
          createdCount += await dueRunner.execute(due, { skipLocked: true });
        } catch (error) {
          failedCount += 1;
          logger.warn({
            event: TodoSeriesLogEvent.MATERIALIZE_FAILED,
            seriesId: due.id,
            errorType: toErrorType(error),
          });
        }
      }
      const lastDue = dueBatch.at(-1);
      afterId = lastDue == null ? null : TodoSeriesId.reconstitute(lastDue.id);
      if (dueBatch.length < batchSize) {
        break;
      }
    }

    const durationMs = performance.now() - startedAt;
    logger.log({
      event: TodoSeriesLogEvent.MATERIALIZED,
      processedCount,
      createdCount,
      failedCount,
      dormantCount,
      timedOut,
      durationMs,
    });
    if (failedCount > 0 || timedOut) {
      alert.raise({
        ...TodoSeriesAlerts.MATERIALIZE_FAILED,
        details: { processedCount, createdCount, failedCount, timedOut, durationMs },
      });
    }
    return { processedCount, createdCount, failedCount, dormantCount, timedOut };
  }
}

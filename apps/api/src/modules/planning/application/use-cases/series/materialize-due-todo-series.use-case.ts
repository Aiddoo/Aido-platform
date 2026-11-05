import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";

import { isSeriesOwnerDormant } from "../../../domain/policies/series/series-dormancy.policy.js";
import { PlanningTodoSeriesLogEvent } from "../../observability/series/planning-todo-series-log.events.js";
import type { TodoSeriesOwnerPort } from "../../ports/series/todo-series-owner.port.js";
import type {
  TodoSeriesRef,
  TodoSeriesRepositoryPort,
} from "../../ports/series/todo-series.repository.port.js";
import type { TodoSeriesDueRunner } from "../../services/series/todo-series-due-runner.service.js";

export const TODO_SERIES_MATERIALIZATION_BUDGET = {
  /** ID만 읽으므로 배치 메모리는 1MB 미만이다. */
  BATCH_SIZE: 100,
  /** 큐 만료(10분)보다 먼저 멈추고 남은 규칙은 다음 실행이 커서로 이어받는다. */
  DEADLINE_MS: 4 * 60 * 1000,
  /** UTC 오늘 + 91일이면 어떤 시간대의 오늘 + 90일도 포함한다. 시간대별 경계는 규칙마다 다시 잰다. */
  DUE_SCAN_AHEAD_DAYS: TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS + 1,
} as const;

export const TODO_SERIES_MATERIALIZE_ALERT_KEY = "planning.todo-series.materialize-failed";

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
  readonly dueRunner: Pick<TodoSeriesDueRunner, "materialize">;
  readonly alert: OperationalAlertPort;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
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
export class MaterializeDueTodoSeries {
  readonly #dependencies: MaterializeDueTodoSeriesDependencies;

  constructor(dependencies: MaterializeDueTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<MaterializeDueTodoSeriesResult> {
    const { logger, alert, seriesRepository, seriesOwner, dueRunner } = this.#dependencies;
    const batchSize = this.#dependencies.batchSize ?? TODO_SERIES_MATERIALIZATION_BUDGET.BATCH_SIZE;
    const deadlineMs =
      this.#dependencies.deadlineMs ?? TODO_SERIES_MATERIALIZATION_BUDGET.DEADLINE_MS;
    const startedAt = Date.now();
    const through = addDaysToDateKey(
      toDateString(now()),
      TODO_SERIES_MATERIALIZATION_BUDGET.DUE_SCAN_AHEAD_DAYS,
    );
    let afterId: string | null = null;
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
        uniq(dueBatch.map(({ userId }) => userId)),
      );
      for (const due of dueBatch) {
        if (Date.now() - startedAt >= deadlineMs) {
          timedOut = true;
          break;
        }
        const owner = owners.get(due.userId);
        if (owner == null) {
          continue;
        }
        if (
          isSeriesOwnerDormant(owner, now()) &&
          !(await seriesOwner.isExemptFromDormancy(due.userId))
        ) {
          dormantCount += 1;
          continue;
        }
        processedCount += 1;
        try {
          // 사용자 수정이나 다른 실행이 규칙 행을 잡고 있으면 기다리지 않는다. 다음 실행이 커서로 이어받는다.
          createdCount += await dueRunner.materialize(due, { skipLocked: true });
        } catch (error) {
          failedCount += 1;
          logger.warn({
            event: PlanningTodoSeriesLogEvent.MATERIALIZE_FAILED,
            seriesId: due.id,
            errorType: toErrorType(error),
          });
        }
      }
      afterId = dueBatch.at(-1)?.id ?? null;
      if (dueBatch.length < batchSize) {
        break;
      }
    }

    const durationMs = Date.now() - startedAt;
    logger.log({
      event: PlanningTodoSeriesLogEvent.MATERIALIZED,
      processedCount,
      createdCount,
      failedCount,
      dormantCount,
      timedOut,
      durationMs,
    });
    if (failedCount > 0 || timedOut) {
      alert.raise({
        key: TODO_SERIES_MATERIALIZE_ALERT_KEY,
        severity: "error",
        message: "반복 할 일 회차 채우기가 일부 끝나지 않았습니다.",
        details: { processedCount, createdCount, failedCount, timedOut, durationMs },
      });
    }
    return { processedCount, createdCount, failedCount, dormantCount, timedOut };
  }
}

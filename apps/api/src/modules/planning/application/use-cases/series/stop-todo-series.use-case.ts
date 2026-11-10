import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { MutationLockKeys, type MutationLockPort } from "#api/shared/application/ports/index";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";

import type { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { PlanningTodoSeriesLogEvent } from "../../observability/series/planning-todo-series-log.events.js";
import type { TodoSeriesRepositoryPort } from "../../ports/series/todo-series.repository.port.js";
import type { TodoReminderPort } from "../../ports/todos/todo-reminder.port.js";
import type { TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import type { TodoSeriesEditEffects } from "../../services/series/todo-series-edit-effects.service.js";

export interface StopTodoSeriesInput {
  readonly todoId: number;
  readonly userId: string;
}

export interface StoppedSeries {
  readonly series: TodoSeries;
  readonly userId: string;
  readonly deletedTodoIds: readonly number[];
}

interface StopTodoSeriesDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "deleteOccurrences">;
  readonly seriesRepository: Pick<
    TodoSeriesRepositoryPort,
    "lockForUpdate" | "lockFollowingSegments" | "update"
  >;
  readonly todoReminder: Pick<TodoReminderPort, "cancelReminders">;
  readonly effects: Pick<TodoSeriesEditEffects, "publish">;
  readonly mutationLock: MutationLockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 이 회차 뒤로 반복을 끝낸다. 나뉜 뒤 구간까지 끝내고, 이 회차와 완료한 회차는 남고 뒤의 미완료 회차만 지운다. */
export class StopTodoSeries {
  readonly #dependencies: StopTodoSeriesDependencies;

  constructor(dependencies: StopTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  /** 활성 UoW 안에서 호출한다. 다른 수정과 한 트랜잭션으로 묶는다. */
  async apply(input: StopTodoSeriesInput): Promise<StoppedSeries> {
    const { todoId, userId } = input;
    const { todoRepository, seriesRepository, todoReminder, mutationLock } = this.#dependencies;
    // 카테고리 삭제와 같은 순서(잠금 → 규칙 행)로 잡아 교착을 막는다.
    await mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);
    const todo = await todoRepository.findByIdAndUserId(todoId, userId);
    if (todo == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    const seriesId = todo.getSeriesId();
    const occurrenceDate = todo.getOccurrenceDate();
    if (seriesId == null || occurrenceDate == null) {
      throw new ApplicationException(ErrorCode.TODO_0844, {
        todoId,
        scope: "THIS_AND_FOLLOWING",
      });
    }
    const series = await seriesRepository.lockForUpdate(seriesId);
    if (series == null || series.getUserId() !== userId) {
      throw new ApplicationException(ErrorCode.TODO_0841, { seriesId });
    }
    const lastDate = toDateString(occurrenceDate);
    const following = await seriesRepository.lockFollowingSegments(series);
    const stopped = [series, ...following].filter((segment) => segment.stopAfter(lastDate));
    if (stopped.length === 0) {
      throw new ApplicationException(ErrorCode.TODO_0846, { seriesId });
    }
    for (const segment of stopped) {
      await seriesRepository.update(segment);
    }
    const deletedTodoIds = await todoRepository.deleteOccurrences({
      userId,
      seriesIds: [seriesId, ...following.map((segment) => segment.getId())],
      fromDate: addDaysToDateKey(lastDate, 1),
      includeCompleted: false,
    });
    await todoReminder.cancelReminders(deletedTodoIds);
    return { series, userId, deletedTodoIds };
  }

  async publish(stopped: StoppedSeries): Promise<void> {
    const { series, userId, deletedTodoIds } = stopped;
    await this.#dependencies.effects.publish({
      seriesId: series.getId(),
      userId,
    });
    this.#dependencies.logger.log({
      event: PlanningTodoSeriesLogEvent.STOPPED,
      seriesId: series.getId(),
      userId,
      deletedCount: deletedTodoIds.length,
    });
  }
}

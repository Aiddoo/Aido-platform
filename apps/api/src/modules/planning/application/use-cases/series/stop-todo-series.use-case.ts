import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/index";

import { PlanningTodoSeriesLogEvent } from "../../observability/series/planning-todo-series-log.events.js";
import type { TodoSeriesRepositoryPort } from "../../ports/series/todo-series.repository.port.js";
import type { TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import type { TodoSeriesEditEffects } from "../../services/series/todo-series-edit-effects.service.js";

export interface StopTodoSeriesInput {
  readonly todoId: number;
  readonly userId: string;
}

interface StopTodoSeriesDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "deleteOccurrences">;
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "lockForUpdate" | "update">;
  readonly effects: Pick<TodoSeriesEditEffects, "publish">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/** 이 회차 뒤로 반복을 끝낸다. 이 회차와 완료한 회차는 남고 뒤의 미완료 회차만 지운다. */
export class StopTodoSeries {
  readonly #dependencies: StopTodoSeriesDependencies;

  constructor(dependencies: StopTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: StopTodoSeriesInput): Promise<void> {
    const { todoId, userId } = input;
    const { todoRepository, seriesRepository, unitOfWork, mutationLock } = this.#dependencies;
    const stopped = await unitOfWork.run(async () => {
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
      // 회차 채우기와 같은 순서(규칙 행 → 사용자 잠금)로 잡아 교착을 막는다.
      const series = await seriesRepository.lockForUpdate(seriesId);
      if (series == null || series.getUserId() !== userId) {
        throw new ApplicationException(ErrorCode.TODO_0841, { seriesId });
      }
      await mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);
      const lastDate = toDateString(occurrenceDate);
      if (!series.stopAfter(lastDate)) {
        throw new ApplicationException(ErrorCode.TODO_0846, { seriesId });
      }
      await seriesRepository.update(series);
      const cancelledTodoIds = await todoRepository.deleteOccurrences(seriesId, {
        fromDate: addDaysToDateKey(lastDate, 1),
        includeCompleted: false,
      });
      return { series, cancelledTodoIds };
    });

    await this.#dependencies.effects.publish({
      seriesId: stopped.series.getId(),
      userId,
      cancelledTodoIds: stopped.cancelledTodoIds,
      reminders: [],
      events: stopped.series.pullDomainEvents(),
    });
    this.#dependencies.logger.log({
      event: PlanningTodoSeriesLogEvent.STOPPED,
      seriesId: stopped.series.getId(),
      userId,
      deletedCount: stopped.cancelledTodoIds.length,
    });
  }
}

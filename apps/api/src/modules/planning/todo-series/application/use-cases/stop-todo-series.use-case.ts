import { TodoCategoryLockKeys } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { todoNotFound } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { addDaysToKey } from "../../../shared/domain/todo-calendar.domain-service.js";
import type { TodoOccurrenceWriterPort } from "../../../todos/application/ports/todo-occurrence-writer.port.js";
import type { TodoReminderSchedulerPort } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type { TodoRepositoryPort } from "../../../todos/application/ports/todo.repository.port.js";
import type { ApplyTodoEventsUseCase } from "../../../todos/application/use-cases/apply-todo-events.use-case.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import { TodoOccurrencesChangedEvent } from "../../domain/todo-occurrences-changed.event.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import { todoNotRepeating, todoSeriesEnded, todoSeriesNotFound } from "../todo-series.errors.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";
import type { PublishTodoSeriesEditUseCase } from "./publish-todo-series-edit.use-case.js";

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
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId">;
  readonly occurrenceWriter: Pick<TodoOccurrenceWriterPort, "deleteOccurrences">;
  readonly seriesRepository: Pick<
    TodoSeriesRepositoryPort,
    "lockForUpdate" | "lockFollowingSegments" | "save"
  >;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "cancelReminders">;
  readonly effects: Pick<PublishTodoSeriesEditUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 이 회차 뒤로 반복을 끝낸다. 나뉜 뒤 구간까지 끝내고, 이 회차와 완료한 회차는 남고 뒤의 미완료 회차만 지운다. */
export class StopTodoSeriesUseCase {
  readonly #dependencies: StopTodoSeriesDependencies;

  constructor(dependencies: StopTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  /** 활성 UoW 안에서 호출한다. 다른 수정과 한 트랜잭션으로 묶는다. */
  async apply(input: StopTodoSeriesInput): Promise<StoppedSeries> {
    const { todoId, userId } = input;
    const { todoRepository, seriesRepository, todoReminder, mutationLock } = this.#dependencies;
    // 카테고리 삭제와 같은 순서(잠금 → 규칙 행)로 잡아 교착을 막는다.
    await mutationLock.acquire([TodoCategoryLockKeys.userCategories(userId)]);
    const ownerId = UserId.reconstitute(userId);
    const todo = await todoRepository.findByIdAndUserId(TodoId.reconstitute(todoId), ownerId);
    if (todo == null) {
      throw todoNotFound(todoId);
    }
    const { seriesId, occurrenceDate } = todo;
    if (seriesId == null || occurrenceDate == null) {
      throw todoNotRepeating(todoId, "THIS_AND_FOLLOWING");
    }
    const series = await seriesRepository.lockForUpdate(seriesId);
    if (series == null || !series.userId.equals(ownerId)) {
      throw todoSeriesNotFound(seriesId.value);
    }
    const lastDate = occurrenceDate.toString();
    const following = await seriesRepository.lockFollowingSegments(series);
    const stopped = [series, ...following].filter((segment) => segment.stopAfter(lastDate));
    // 이미 끝난 반복에 다시 끝내기를 보내면 stopAfter는 false지만, 출시 앱이 받던 TODO_0846을 계약으로 지켜 거절한다
    if (stopped.length === 0) {
      throw todoSeriesEnded(seriesId.value);
    }
    for (const segment of stopped) {
      await seriesRepository.save(segment);
    }
    const deletedTodoIds = await this.#dependencies.occurrenceWriter.deleteOccurrences({
      userId: ownerId,
      seriesIds: [series.id, ...following.map((segment) => segment.id)],
      fromDate: addDaysToKey(lastDate, 1),
      includeCompleted: false,
    });
    await todoReminder.cancelReminders(deletedTodoIds.map((id) => TodoId.reconstitute(id)));
    await this.#dependencies.applyTodoEvents.execute([
      new TodoOccurrencesChangedEvent(seriesId.value, userId),
    ]);
    return { series, userId, deletedTodoIds };
  }

  async publish(stopped: StoppedSeries): Promise<void> {
    const { series, userId, deletedTodoIds } = stopped;
    await this.#dependencies.effects.execute({
      seriesId: series.id.value,
      userId,
    });
    this.#dependencies.logger.log({
      event: TodoSeriesLogEvent.STOPPED,
      seriesId: series.id.value,
      userId,
      deletedCount: deletedTodoIds.length,
    });
  }
}

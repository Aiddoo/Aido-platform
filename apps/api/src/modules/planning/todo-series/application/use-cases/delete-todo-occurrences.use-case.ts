import type { TodoEditScope } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { TodoCategoryLockKeys } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoOccurrenceWriterPort } from "../../../todos/application/ports/todo-occurrence-writer.port.js";
import type { TodoReminderSchedulerPort } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type { TodoRepositoryPort } from "../../../todos/application/ports/todo.repository.port.js";
import { todoNotFound } from "../../../todos/application/todos.errors.js";
import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import { TodoLogEvent } from "../../../todos/application/todos.log-events.js";
import type { ApplyTodoEventsUseCase } from "../../../todos/application/use-cases/apply-todo-events.use-case.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import type { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import type { TodoSeries, TodoSeriesEvent } from "../../domain/todo-series.aggregate.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import { todoNotRepeating, todoSeriesNotFound } from "../todo-series.errors.js";
import type { PublishTodoSeriesEditUseCase } from "./publish-todo-series-edit.use-case.js";

interface DeletedOccurrences {
  readonly deletedTodoIds: readonly number[];
  readonly events: readonly TodoSeriesEvent[];
}

export interface DeleteTodoOccurrencesInput {
  readonly todoId: number;
  readonly userId: string;
  readonly scope: Exclude<TodoEditScope, "THIS_ONLY">;
}

interface DeleteTodoOccurrencesDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId">;
  readonly occurrenceWriter: Pick<TodoOccurrenceWriterPort, "deleteOccurrences">;
  readonly seriesRepository: Pick<
    TodoSeriesRepositoryPort,
    "lockForUpdate" | "save" | "lockFamilyIds" | "lockFollowingSegments" | "deleteMany"
  >;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "cancelReminders">;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly effects: Pick<PublishTodoSeriesEditUseCase, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLoggerPort;
}

// 회차 하나에서 이후 모두(THIS_AND_FOLLOWING)·전체(ALL)를 지운다. 반복 규칙 행을 끝내거나 지우는 것도 이 slice가 한다
export class DeleteTodoOccurrencesUseCase {
  readonly #dependencies: DeleteTodoOccurrencesDependencies;

  constructor(dependencies: DeleteTodoOccurrencesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoOccurrencesInput): Promise<void> {
    const { todoId, userId, scope } = input;
    const ownerId = UserId.reconstitute(userId);
    const { todoRepository, seriesRepository, todoReminder, unitOfWork, mutationLock } =
      this.#dependencies;
    const deleted = await unitOfWork.run(async () => {
      // 이후 모두 고치기·카테고리 삭제와 같은 순서(카테고리 → 순서 잠금 → 규칙 행 → 할 일 행)로 잡아 교착을 막는다
      await mutationLock.acquire([
        TodoCategoryLockKeys.userCategories(userId),
        TodoLockKeys.sortOrder(userId),
      ]);
      const todo = await todoRepository.findByIdAndUserId(TodoId.reconstitute(todoId), ownerId);
      if (todo == null) {
        throw todoNotFound(todoId);
      }
      const { seriesId } = todo;
      if (seriesId == null) {
        throw todoNotRepeating(todoId, scope);
      }
      const series = await seriesRepository.lockForUpdate(seriesId);
      if (series != null && !series.userId.equals(ownerId)) {
        throw todoSeriesNotFound(seriesId.value);
      }
      const { deletedTodoIds, events } = await match(scope)
        .with("ALL", () => this.#deleteAll(ownerId, seriesId, series))
        .with("THIS_AND_FOLLOWING", () => {
          // 규칙이 없는 묶음은 회차 날짜도 없어 "이후"의 기준이 없다
          const { occurrenceDate } = todo;
          if (occurrenceDate == null) {
            throw todoNotRepeating(todoId, scope);
          }
          return this.#deleteFollowing({ ownerId, seriesId, series, pivot: occurrenceDate });
        })
        .exhaustive();
      await todoReminder.cancelReminders(deletedTodoIds.map((id) => TodoId.reconstitute(id)));
      await this.#dependencies.applyTodoEvents.execute(events);
      return { seriesId, deletedTodoIds };
    });

    await this.#dependencies.effects.execute({ seriesId: deleted.seriesId.value, userId });
    this.#dependencies.logger.log({
      event: TodoLogEvent.DELETED,
      todoId,
      userId,
      scope,
      deletedCount: deleted.deletedTodoIds.length,
    });
  }

  // 이후 수정으로 나뉜 앞 구간까지 사용자에게는 하나의 반복 할 일이다.
  // 규칙이 없는 묶음(1.14.2로 되돌린 동안 생긴 것)은 그 묶음만 지운다
  async #deleteAll(
    ownerId: UserId,
    seriesId: TodoSeriesId,
    series: TodoSeries | null,
  ): Promise<DeletedOccurrences> {
    const { seriesRepository, occurrenceWriter } = this.#dependencies;
    const seriesIds =
      series == null
        ? [seriesId]
        : await seriesRepository.lockFamilyIds(ownerId, series.originSeriesId);
    const deletedTodoIds = await occurrenceWriter.deleteOccurrences({
      userId: ownerId,
      seriesIds,
      includeCompleted: true,
    });
    await seriesRepository.deleteMany(seriesIds);
    series?.markDeleted();
    return { deletedTodoIds, events: series?.pullDomainEvents() ?? [] };
  }

  async #deleteFollowing(deletion: {
    readonly ownerId: UserId;
    readonly seriesId: TodoSeriesId;
    readonly series: TodoSeries | null;
    readonly pivot: Temporal.PlainDate;
  }): Promise<DeletedOccurrences> {
    const { ownerId, seriesId, series, pivot } = deletion;
    const { seriesRepository, occurrenceWriter } = this.#dependencies;
    const following = series == null ? [] : await seriesRepository.lockFollowingSegments(series);
    const deletedTodoIds = await occurrenceWriter.deleteOccurrences({
      userId: ownerId,
      seriesIds: [seriesId, ...following.map((segment) => segment.id)],
      fromDate: pivot.toString(),
      includeCompleted: false,
    });
    const segments = series == null ? [] : [series, ...following];
    for (const segment of segments) {
      if (segment.stopAfter(pivot.subtract({ days: 1 }))) {
        await seriesRepository.save(segment);
      }
    }
    return { deletedTodoIds, events: segments.flatMap((segment) => segment.pullDomainEvents()) };
  }
}

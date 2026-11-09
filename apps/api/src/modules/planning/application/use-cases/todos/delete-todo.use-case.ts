import { ErrorCode } from "@aido/api/errors";
import type { TodoEditScope } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/index";

import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import type { TodoSeriesRepositoryPort } from "../../ports/series/todo-series.repository.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import type { TodoReminderPort } from "../../ports/todos/todo-reminder.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import type { TodoSeriesEditEffects } from "../../services/series/todo-series-edit-effects.service.js";

export interface DeleteTodoInput {
  readonly id: number;
  readonly userId: string;
  /** 생략은 THIS_ONLY와 같고, 명시했는데 반복이 아니면 TODO_0844다. */
  readonly scope?: TodoEditScope;
}

interface DeleteTodoDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "findByIdAndUserId" | "delete" | "deleteOccurrences"
  >;
  readonly seriesRepository: Pick<
    TodoSeriesRepositoryPort,
    "lockForUpdate" | "update" | "lockFamilyIds" | "lockFollowingSegments" | "deleteMany"
  >;
  readonly seriesEffects: Pick<TodoSeriesEditEffects, "publish">;
  readonly todoReminder: Pick<TodoReminderPort, "cancelReminders">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLogger;
}

export class DeleteTodo {
  readonly #dependencies: DeleteTodoDependencies;

  constructor(dependencies: DeleteTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoInput): Promise<void> {
    const { id, userId, scope = "THIS_ONLY" } = input;
    if (scope !== "THIS_ONLY") {
      await this.#deleteOccurrences(input, scope);
      return;
    }

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(userId),
        MutationLockKeys.todo(id),
      ]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }
      if (input.scope != null && todo.getSeriesId() == null) {
        throw new ApplicationException(ErrorCode.TODO_0844, { todoId: id, scope: input.scope });
      }

      await this.#dependencies.todoRepository.delete(id);

      todo.markDeleted();
      return todo.pullDomainEvents();
    });

    await this.#dependencies.eventPublisher.publishAll(events);

    await this.#dependencies.todoCache.invalidateTodoCategories(userId);
    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    this.#dependencies.logger.log({ event: PlanningTodoLogEvent.DELETED, todoId: id, userId });
  }

  async #deleteOccurrences(
    input: DeleteTodoInput,
    scope: Exclude<TodoEditScope, "THIS_ONLY">,
  ): Promise<void> {
    const { id, userId } = input;
    const { todoRepository, seriesRepository, todoReminder, unitOfWork, mutationLock } =
      this.#dependencies;
    const deleted = await unitOfWork.run(async () => {
      // 카테고리 삭제와 같은 순서(잠금 → 규칙 행)로 잡아 교착을 막는다.
      await mutationLock.acquire([MutationLockKeys.todoCategory(userId)]);
      const todo = await todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }
      const seriesId = todo.getSeriesId();
      if (seriesId == null) {
        throw new ApplicationException(ErrorCode.TODO_0844, { todoId: id, scope });
      }
      const series = await seriesRepository.lockForUpdate(seriesId);
      if (series != null && series.getUserId() !== userId) {
        throw new ApplicationException(ErrorCode.TODO_0841, { seriesId });
      }
      const deletedTodoIds = await match(scope)
        .with("ALL", async () => {
          // 이후 수정으로 나뉜 앞 구간까지 사용자에게는 하나의 반복 할 일이다.
          // 규칙이 없는 묶음(1.14.2로 되돌린 동안 생긴 것)은 그 묶음만 지운다.
          const seriesIds =
            series == null
              ? [seriesId]
              : await seriesRepository.lockFamilyIds(userId, series.getOriginSeriesId());
          const ids = await todoRepository.deleteOccurrences({
            userId,
            seriesIds,
            includeCompleted: true,
          });
          await seriesRepository.deleteMany(seriesIds);
          return ids;
        })
        .with("THIS_AND_FOLLOWING", async () => {
          // 규칙이 없는 묶음은 회차 날짜도 없어 "이후"의 기준이 없다.
          const occurrenceDate = todo.getOccurrenceDate();
          if (occurrenceDate == null) {
            throw new ApplicationException(ErrorCode.TODO_0844, { todoId: id, scope });
          }
          const pivot = toDateString(occurrenceDate);
          const following =
            series == null ? [] : await seriesRepository.lockFollowingSegments(series);
          const ids = await todoRepository.deleteOccurrences({
            userId,
            seriesIds: [seriesId, ...following.map((segment) => segment.getId())],
            fromDate: pivot,
            includeCompleted: false,
          });
          for (const segment of series == null ? [] : [series, ...following]) {
            if (segment.stopAfter(addDaysToDateKey(pivot, -1))) {
              await seriesRepository.update(segment);
            }
          }
          return ids;
        })
        .exhaustive();
      await todoReminder.cancelReminders(deletedTodoIds);
      return { seriesId, deletedTodoIds };
    });

    await this.#dependencies.seriesEffects.publish({
      seriesId: deleted.seriesId,
      userId,
    });
    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.DELETED,
      todoId: id,
      userId,
      scope,
      deletedCount: deleted.deletedTodoIds.length,
    });
  }
}

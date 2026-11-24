import { randomUUID } from "node:crypto";

import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoChangedEvent } from "../../domain/todo-changed.event.js";
import type { TodoId } from "../../domain/todo-id.vo.js";
import type { RemovedTodo, TodoBulkRemoverPort } from "../ports/todo-bulk-remover.port.js";
import type { TodoCachePort } from "../ports/todo-cache.port.js";
import type { TodoReminderSchedulerPort } from "../ports/todo-reminder-scheduler.port.js";

export interface RemoveTodosCommand {
  readonly userId: UserId;
  readonly todoIds: readonly TodoId[];
}

export interface RemoveTodosResult {
  readonly todoCount: number;
}

interface RemoveTodosDependencies {
  readonly bulkRemover: Pick<TodoBulkRemoverPort, "removeIncompleteByIds">;
  readonly reminderScheduler: Pick<TodoReminderSchedulerPort, "cancelReminders">;
  readonly eventPublisher: Pick<DomainEventPublisherPort, "publish">;
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly clock: ClockPort;
}

// 가져오기 되돌리기처럼 여러 할 일을 단건 삭제와 같은 효과로 한꺼번에 지운다. 완료한 할 일은 연속 기록·성취를
// 지키려고 남긴다. 활성 UoW 안에서 부른다
export class RemoveTodosUseCase {
  readonly #dependencies: RemoveTodosDependencies;

  constructor(dependencies: RemoveTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RemoveTodosCommand): Promise<RemoveTodosResult> {
    const { userId } = command;
    const removed = await this.#dependencies.bulkRemover.removeIncompleteByIds(
      userId,
      command.todoIds,
    );
    if (removed.length === 0) {
      return { todoCount: 0 };
    }
    await this.#cancelReminders(removed);
    await this.#publishDeleted(userId, removed);
    const { todoCache, afterCommit } = this.#dependencies;
    afterCommit.register(async () => {
      await todoCache.invalidateTodoCategories(userId);
      await todoCache.invalidateFriendTodos(userId);
    });
    return { todoCount: removed.length };
  }

  async #cancelReminders(removed: readonly RemovedTodo[]): Promise<void> {
    // 리마인더 작업은 시각이 있던 할 일에만 있다
    const scheduledTodoIds = removed
      .filter((removedTodo) => removedTodo.scheduledTime != null)
      .map((removedTodo) => removedTodo.id);
    if (scheduledTodoIds.length > 0) {
      await this.#dependencies.reminderScheduler.cancelReminders(scheduledTodoIds);
    }
  }

  async #publishDeleted(userId: UserId, removed: readonly RemovedTodo[]): Promise<void> {
    const occurredAt = this.#dependencies.clock.now();
    await this.#dependencies.eventPublisher.publish(
      removed.map(
        (removedTodo) =>
          new TodoChangedEvent({
            eventName: "planning.todo.deleted",
            eventId: randomUUID(),
            occurredAt,
            todoId: removedTodo.id.value,
            userId: userId.value,
          }),
      ),
    );
  }
}

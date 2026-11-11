import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import type { TodoBulkRemoverPort } from "../ports/todo-bulk-remover.port.js";
import type { TodoCachePort } from "../ports/todo-cache.port.js";
import type { TodoReminderSchedulerPort } from "../ports/todo-reminder-scheduler.port.js";

export interface RemoveCategoryTodosCommand {
  readonly userId: UserId;
  readonly categoryId: TodoCategoryId;
}

export interface RemoveCategoryTodosResult {
  readonly todoCount: number;
  readonly seriesCount: number;
}

interface RemoveCategoryTodosDependencies {
  readonly bulkRemover: Pick<TodoBulkRemoverPort, "removeByCategory">;
  readonly reminderScheduler: Pick<TodoReminderSchedulerPort, "cancelReminders">;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
}

/**
 * 카테고리를 지울 때 안의 할 일·반복 규칙을 단건 삭제와 같은 효과로 한꺼번에 지운다.
 * 카테고리 삭제의 활성 UoW와 잠금(todoCategory·todoSortOrder) 안에서 부른다.
 * 다른 Context에는 할 일마다 planning.todo.deleted를 내지 않고 카테고리 삭제 사실 하나로 알린다
 * (그 이벤트의 구독자인 insights 일간 완료 캐시는 사용자 단위로 지운다).
 */
export class RemoveCategoryTodosUseCase {
  readonly #dependencies: RemoveCategoryTodosDependencies;

  constructor(dependencies: RemoveCategoryTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RemoveCategoryTodosCommand): Promise<RemoveCategoryTodosResult> {
    const { bulkRemover, reminderScheduler, todoCache, afterCommit } = this.#dependencies;
    const removed = await bulkRemover.removeByCategory(command.userId, command.categoryId);
    // 리마인더 작업은 시각이 있는 할 일에만 있다. 결정적 작업 id로 한 문장에 지운다
    const scheduledTodoIds = removed.todos
      .filter((removedTodo) => removedTodo.scheduledTime != null)
      .map((removedTodo) => removedTodo.id.value);
    if (scheduledTodoIds.length > 0) {
      await reminderScheduler.cancelReminders(scheduledTodoIds);
    }
    if (removed.todos.length > 0) {
      afterCommit.register(() => todoCache.invalidateFriendTodos(command.userId));
    }
    return { todoCount: removed.todos.length, seriesCount: removed.seriesCount };
  }
}

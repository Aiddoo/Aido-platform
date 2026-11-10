import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { TodoTitle } from "../../../shared/domain/todo-title.vo.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { TodoLockKeys } from "../todos.lock-keys.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { ApplyTodoCompletionEffectsUseCase } from "./apply-todo-completion-effects.use-case.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export interface AddTodoItemInput {
  readonly todoId: number;
  readonly userId: string;
  readonly title: string;
  /** 완료를 되돌릴 때 스트릭의 "오늘" 경계 */
  readonly timezone: string;
}

interface AddTodoItemDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "findByIdAndUserId" | "nextItemId" | "insertItem" | "updateDetails"
  >;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly completionEffects: Pick<ApplyTodoCompletionEffectsUseCase, "execute">;
  readonly logger: ApplicationLoggerPort;
}

export class AddTodoItemUseCase {
  readonly #dependencies: AddTodoItemDependencies;

  constructor(dependencies: AddTodoItemDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: AddTodoItemInput): Promise<TodoReadModel> {
    const { todoId, userId, title, timezone } = input;

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(todoId)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(todoId, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
      }

      const { todoRepository, clock } = this.#dependencies;
      const itemTitle = TodoTitle.create(title);
      const now = clock.now();
      const item = todo.addItem({ id: await todoRepository.nextItemId(), title: itemTitle, now });
      await todoRepository.insertItem(todoId, item);

      if (!todo.reopenForAddedItem(timezone, now)) {
        return [];
      }
      await todoRepository.updateDetails(todoId, {
        completed: todo.completed,
        completedAt: todo.completedAt,
      });
      this.#dependencies.logger.log({
        event: TodoLogEvent.COMPLETION_CHANGED,
        todoId,
        userId,
        completed: todo.completed,
      });
      const events = todo.pullDomainEvents();
      await this.#dependencies.applyTodoEvents.execute(events);
      return events;
    });

    this.#dependencies.logger.log({ event: TodoLogEvent.ITEM_ADDED, todoId, userId });

    await this.#dependencies.completionEffects.execute(events);

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(todoId, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
    }
    return response;
  }
}

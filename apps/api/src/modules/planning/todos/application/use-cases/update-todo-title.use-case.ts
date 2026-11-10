import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { TodoTitle } from "../../../shared/domain/todo-title.vo.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

export interface UpdateTodoTitleInput {
  readonly id: number;
  readonly userId: string;
  readonly title: string;
}

interface UpdateTodoTitleDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateTitle">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoTitleUseCase {
  readonly #dependencies: UpdateTodoTitleDependencies;

  constructor(dependencies: UpdateTodoTitleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoTitleInput): Promise<TodoReadModel> {
    const { id, userId, title } = input;

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(id)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      if (!todo.rename(TodoTitle.create(title), this.#dependencies.clock.now())) {
        return;
      }
      await this.#dependencies.todoRepository.updateTitle(id, todo.title.value);
      await this.#dependencies.applyTodoEvents.execute(todo.pullDomainEvents());
    });

    this.#dependencies.logger.log({
      event: TodoLogEvent.TITLE_UPDATED,
      todoId: id,
      userId,
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}

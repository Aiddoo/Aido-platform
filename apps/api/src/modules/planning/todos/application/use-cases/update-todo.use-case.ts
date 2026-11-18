import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../domain/todo-id.vo.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { todoNotFound } from "../todos.errors.js";
import type { ApplyTodoCompletionEffectsUseCase } from "./apply-todo-completion-effects.use-case.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";
import type { ApplyTodoUpdateUseCase, UpdateTodoInput } from "./apply-todo-update.use-case.js";
import type { PublishTodoUpdateUseCase } from "./publish-todo-update.use-case.js";

interface UpdateTodoDependencies {
  readonly applyUpdate: Pick<ApplyTodoUpdateUseCase, "execute">;
  readonly publishUpdate: Pick<PublishTodoUpdateUseCase, "execute">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly completionEffects: Pick<ApplyTodoCompletionEffectsUseCase, "execute">;
}

/** 할 일 하나의 수정을 한 트랜잭션으로 저장하고 커밋 뒤 효과를 낸다. */
export class UpdateTodoUseCase {
  readonly #dependencies: UpdateTodoDependencies;

  constructor(dependencies: UpdateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoInput): Promise<TodoReadModel> {
    const { id, userId } = input;
    const applied = await this.#dependencies.unitOfWork.run(async () => {
      const updated = await this.#dependencies.applyUpdate.execute(input);
      await this.#dependencies.applyTodoEvents.execute(updated.events);
      await this.#dependencies.completionEffects.execute(updated.events);
      return updated;
    });
    await this.#dependencies.publishUpdate.execute(applied);
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      TodoId.reconstitute(id),
      UserId.reconstitute(userId),
    );
    if (response == null) {
      throw todoNotFound(id);
    }
    return response;
  }
}

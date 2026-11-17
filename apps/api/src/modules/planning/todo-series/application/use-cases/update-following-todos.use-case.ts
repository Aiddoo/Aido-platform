import { todoNotFound } from "#api/modules/planning/todos/planning-todos-queries.public";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoReadRepositoryPort } from "../../../todos/application/ports/todo-read.repository.port.js";
import type { TodoReadModel } from "../../../todos/application/read-models/todo.read-model.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import type {
  ApplyFollowingTodosUpdateUseCase,
  UpdateFollowingTodosInput,
} from "./apply-following-todos-update.use-case.js";
import type { PublishFollowingTodosUpdateUseCase } from "./publish-following-todos-update.use-case.js";

interface UpdateFollowingTodosDependencies {
  readonly applyUpdate: Pick<ApplyFollowingTodosUpdateUseCase, "execute">;
  readonly publishUpdate: Pick<PublishFollowingTodosUpdateUseCase, "execute">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
}

/** 이 회차와 이후 회차 고치기 하나를 한 트랜잭션으로 처리하고 커밋 뒤 효과를 낸다. */
export class UpdateFollowingTodosUseCase {
  readonly #dependencies: UpdateFollowingTodosDependencies;

  constructor(dependencies: UpdateFollowingTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateFollowingTodosInput): Promise<TodoReadModel> {
    const { userId } = input;
    const { applyUpdate, publishUpdate, unitOfWork, todoReadRepository } = this.#dependencies;
    const edited = await unitOfWork.run(() => applyUpdate.execute(input));
    await publishUpdate.execute({ edited, userId });

    const response = await todoReadRepository.findByIdAndUserId(
      TodoId.reconstitute(edited.responseTodoId),
      UserId.reconstitute(userId),
    );
    if (response == null) {
      throw todoNotFound(edited.responseTodoId);
    }
    return response;
  }
}

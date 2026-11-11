import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { TodoEngagementCounterPort } from "#api/modules/planning/todos/planning-todos.public";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { todoNotFound } from "../comments.errors.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type { TodoDetailsReadModel } from "../read-models/todo-comment.read-model.js";

export interface GetTodoDetailsQuery {
  readonly todoId: number;
  readonly viewerId: string;
}

interface GetTodoDetailsDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly reader: Pick<TodoCommentReaderPort, "findAccessibleTodoDetails">;
  readonly engagementCounter: Pick<TodoEngagementCounterPort, "recordView">;
}

/** 주인이 아닌 사람이 처음 열 때만 조회 수를 올린다 */
export class GetTodoDetailsUseCase {
  readonly #dependencies: GetTodoDetailsDependencies;

  constructor(dependencies: GetTodoDetailsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(query: GetTodoDetailsQuery): Promise<TodoDetailsReadModel> {
    const { unitOfWork, reader, engagementCounter } = this.#dependencies;
    return unitOfWork.run(async () => {
      const details = await reader.findAccessibleTodoDetails(
        TodoId.reconstitute(query.todoId),
        UserId.reconstitute(query.viewerId),
      );
      if (details == null) {
        throw todoNotFound(query.todoId);
      }
      if (details.isOwner) {
        return details;
      }
      const view = await engagementCounter.recordView(
        TodoId.reconstitute(query.todoId),
        UserId.reconstitute(query.viewerId),
      );
      return { ...details, viewCount: view.viewCount };
    });
  }
}

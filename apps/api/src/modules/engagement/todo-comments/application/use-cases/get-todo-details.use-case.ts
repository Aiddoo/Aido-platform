import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { TodoEngagementCounterPort } from "#api/modules/planning/todos/planning-todos.public";
import { canNudgeTodoOn } from "#api/modules/social/nudges/social-nudges.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import { getTodoDetailsPermissions } from "../../domain/todo-comment-permission.domain-service.js";
import type { TodoCommentAccessReaderPort } from "../ports/todo-comment-access.reader.port.js";
import type {
  TodoDetailsReadModel,
  ViewerTodoDetailsReadModel,
} from "../read-models/todo-comment.read-model.js";
import { todoNotFound } from "../todo-comments.errors.js";

export interface GetTodoDetailsQuery {
  readonly todoId: number;
  readonly viewerId: string;
  /** 보는 사람의 오늘을 정하는 시간대(X-Timezone). 콕 보내기와 같은 하루로 canNudge를 판단한다 */
  readonly timezone: string;
}

interface GetTodoDetailsDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly accessReader: Pick<TodoCommentAccessReaderPort, "findAccessibleTodoDetails">;
  readonly engagementCounter: Pick<TodoEngagementCounterPort, "recordView">;
  readonly clock: ClockPort;
}

/** 주인이 아닌 사람이 처음 열 때만 조회 수를 올린다 */
export class GetTodoDetailsUseCase {
  readonly #dependencies: GetTodoDetailsDependencies;

  constructor(dependencies: GetTodoDetailsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetTodoDetailsQuery): Promise<ViewerTodoDetailsReadModel> {
    const details = await this.#readDetails(query);
    const { todo } = details;
    const today = localDateIn(this.#dependencies.clock.now(), query.timezone);
    const isNudgeableToday = canNudgeTodoOn(
      {
        completed: todo.completed,
        startDate: Temporal.PlainDate.from(todo.startDate),
        endDate: todo.endDate == null ? null : Temporal.PlainDate.from(todo.endDate),
      },
      today,
    );
    return {
      ...details,
      permissions: getTodoDetailsPermissions({ isOwner: details.isOwner, isNudgeableToday }),
    };
  }

  #readDetails(query: GetTodoDetailsQuery): Promise<TodoDetailsReadModel> {
    const { unitOfWork, accessReader, engagementCounter } = this.#dependencies;
    const todoId = TodoId.reconstitute(query.todoId);
    const viewerId = UserId.reconstitute(query.viewerId);
    return unitOfWork.run(async () => {
      const details = await accessReader.findAccessibleTodoDetails(todoId, viewerId);
      if (details == null) {
        throw todoNotFound(todoId);
      }
      if (details.isOwner) {
        return details;
      }
      const view = await engagementCounter.recordView(todoId, viewerId);
      return { ...details, viewCount: view.viewCount };
    });
  }
}

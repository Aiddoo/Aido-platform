import { ErrorCode } from "@aido/api/errors";

import { TodoCategoryLockKeys } from "#api/modules/planning/categories/planning-categories.public";
import type {
  CreateTodoData,
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { TodoLockKeys } from "#api/modules/planning/todos/planning-todos.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../../domain/memo-id.vo.js";
import { memoNotFound } from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

type ConvertedTodo = StagedTodoCreation["todos"][number];

export interface ConvertMemoToTodoCommand {
  readonly userId: string;
  readonly memoId: number;
  readonly timezone: string | undefined;
  readonly todo: Pick<
    CreateTodoData,
    "categoryId" | "startDate" | "endDate" | "scheduledTime" | "isAllDay" | "visibility" | "items"
  >;
}

export interface ConvertMemoToTodoDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly afterCommit: AfterCommitTaskRegistryPort;
  readonly memoRepository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly todoCreator: Pick<StagedTodoCreatorPort, "stage">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class ConvertMemoToTodoUseCase {
  readonly #dependencies: ConvertMemoToTodoDependencies;

  constructor(dependencies: ConvertMemoToTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ConvertMemoToTodoCommand): Promise<ConvertedTodo> {
    const { unitOfWork, mutationLock, afterCommit, memoRepository, todoCreator, logger } =
      this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const memoId = MemoId.reconstitute(command.memoId);

    const todo = await unitOfWork.run(async () => {
      await mutationLock.acquire([
        MemoLockKeys.memo(memoId),
        MemoLockKeys.sortOrder(userId),
        TodoCategoryLockKeys.userCategories(command.userId),
        TodoLockKeys.sortOrder(command.userId),
      ]);
      const memo = await memoRepository.findByIdAndUserId(memoId, userId);
      if (memo == null) {
        throw memoNotFound(memoId);
      }
      const staged = await todoCreator.stage({
        ...command.todo,
        userId: command.userId,
        title: memo.toTodoTitle(),
        timezone: command.timezone,
        isAllDay: command.todo.isAllDay ?? true,
        visibility: command.todo.visibility ?? "PUBLIC",
      });
      const createdTodo = staged.todos.at(0);
      if (createdTodo == null) {
        throw new ApplicationException(ErrorCode.SYS_0001, {
          detail: "Staged todo creation returned no todo",
        });
      }
      afterCommit.register(staged.afterCommit);
      await memoRepository.delete(memo);
      return createdTodo;
    });

    logger.log({
      event: MemoLogEvent.CONVERTED,
      memoId: command.memoId,
      userId: command.userId,
      todoCount: 1,
    });
    return todo;
  }
}

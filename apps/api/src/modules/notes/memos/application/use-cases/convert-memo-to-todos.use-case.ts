import { TodoCategoryLockKeys } from "#api/modules/planning/categories/planning-categories.public";
import type {
  CreateTodoData,
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { TodoLockKeys } from "#api/modules/planning/todos/planning-todos.public";
import type { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { SavepointRunnerPort } from "#api/shared/application/ports/savepoint-runner.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoId } from "../../domain/memo-id.vo.js";
import { memoNotFound } from "../memos.errors.js";
import { MemoLockKeys } from "../memos.lock-keys.js";
import { MemoLogEvent } from "../memos.log-events.js";
import type { MemoRepositoryPort } from "../ports/memo.repository.port.js";

type ConvertedTodo = StagedTodoCreation["todos"][number];

type ConversionOutcome =
  | { readonly kind: "converted"; readonly todos: readonly ConvertedTodo[] }
  | { readonly kind: "failed"; readonly error: unknown };

export interface ConvertMemoToTodosCommand {
  readonly userId: string;
  readonly memoId: number;
  readonly timezone: string | undefined;
  readonly todos: readonly Pick<
    CreateTodoData,
    | "title"
    | "categoryId"
    | "startDate"
    | "endDate"
    | "scheduledTime"
    | "isAllDay"
    | "visibility"
    | "items"
    | "repeat"
    | "usesLegacySeriesLimit"
  >[];
}

export interface ConvertMemoToTodosDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly savepointRunner: SavepointRunnerPort;
  readonly afterCommit: AfterCommitTaskRegistryPort;
  readonly memoRepository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly todoCreator: Pick<StagedTodoCreatorPort, "stage">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class ConvertMemoToTodosUseCase {
  readonly #dependencies: ConvertMemoToTodosDependencies;

  constructor(dependencies: ConvertMemoToTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ConvertMemoToTodosCommand): Promise<readonly ConvertedTodo[]> {
    const { unitOfWork, mutationLock, memoRepository, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const memoId = MemoId.reconstitute(command.memoId);

    const outcome = await unitOfWork.run<ConversionOutcome>(async () => {
      await mutationLock.acquire([
        ...MemoLockKeys.existingMemo(memoId, userId),
        TodoCategoryLockKeys.userCategories(command.userId),
        TodoLockKeys.sortOrder(command.userId),
      ]);
      const memo = await memoRepository.findByIdAndUserId(memoId, userId);
      if (memo == null) {
        throw memoNotFound(memoId);
      }
      const staged = await this.#stageInOrder(command);
      if (staged.kind === "failed") {
        return staged;
      }
      await memoRepository.delete(memo);
      return staged;
    });
    // 성공한 앞 항목은 실제로 커밋하고, 그 효과가 정착한 뒤 원래 오류를 전달한다(메모는 남는다)
    if (outcome.kind === "failed") {
      throw outcome.error;
    }

    logger.log({
      event: MemoLogEvent.CONVERTED,
      memoId: command.memoId,
      userId: command.userId,
      todoCount: outcome.todos.length,
    });
    return outcome.todos;
  }

  async #stageInOrder(command: ConvertMemoToTodosCommand): Promise<ConversionOutcome> {
    const { savepointRunner, afterCommit, todoCreator } = this.#dependencies;
    const todos: ConvertedTodo[] = [];
    for (const draft of command.todos) {
      try {
        const staged = await savepointRunner.run(() =>
          todoCreator.stage({
            ...draft,
            userId: command.userId,
            timezone: command.timezone,
            isAllDay: draft.isAllDay ?? true,
            visibility: draft.visibility ?? "PUBLIC",
          }),
        );
        afterCommit.register(staged.afterCommit);
        todos.push(...staged.todos);
      } catch (error) {
        return { kind: "failed", error };
      }
    }
    return { kind: "converted", todos };
  }
}

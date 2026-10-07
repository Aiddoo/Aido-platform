import type { Todo } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
  type AfterCommitTaskRegistryPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NotesMemoLogEvent } from "../../observability/memos/notes-memo-log.events.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import type { StagedTodoCreatorPort } from "../../ports/memos/staged-todo-creator.port.js";

export interface ConvertMemoToTodoData {
  readonly categoryId: number;
  readonly startDate: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: Date | null;
  readonly isAllDay?: boolean;
  readonly visibility?: "PUBLIC" | "PRIVATE";
  readonly items?: { title: string }[];
}

export interface ConvertMemoToTodoResult {
  readonly message: string;
  readonly todo: Todo;
}

export interface ConvertMemoToTodoInput {
  readonly userId: string;
  readonly memoId: number;
  readonly data: ConvertMemoToTodoData;
}

interface ConvertMemoToTodoDependencies {
  readonly repository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly todoCreator: Pick<StagedTodoCreatorPort, "stageTodo">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly afterCommit: AfterCommitTaskRegistryPort;
  readonly logger: ApplicationLogger;
}

export class ConvertMemoToTodo {
  readonly #dependencies: ConvertMemoToTodoDependencies;

  constructor(dependencies: ConvertMemoToTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ConvertMemoToTodoInput): Promise<ConvertMemoToTodoResult> {
    const { userId, memoId, data } = input;
    const todo = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.memo(memoId),
        MutationLockKeys.memoSortOrder(userId),
        MutationLockKeys.todoCategory(userId),
        MutationLockKeys.todoSortOrder(userId),
      ]);
      const memo = await this.#dependencies.repository.findByIdAndUserId(memoId, userId);
      if (memo === null) throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
      const staged = await this.#dependencies.todoCreator.stageTodo({
        userId,
        title: memo.toTodoTitle(),
        categoryId: data.categoryId,
        startDate: data.startDate,
        endDate: data.endDate,
        scheduledTime: data.scheduledTime,
        isAllDay: data.isAllDay ?? true,
        visibility: data.visibility ?? "PUBLIC",
        items: data.items,
      });
      const createdTodo = staged.todos.at(0);
      if (createdTodo === undefined) {
        throw new ApplicationException(ErrorCode.SYS_0001, {
          detail: "Staged todo creation returned no todo",
        });
      }
      this.#dependencies.afterCommit.register(staged.afterCommit);
      await this.#dependencies.repository.delete(memoId);
      return createdTodo;
    });

    this.#dependencies.logger.log({
      event: NotesMemoLogEvent.CONVERTED,
      memoId,
      userId,
      todoCount: 1,
    });
    return { message: "메모가 할 일로 변환되었습니다.", todo };
  }
}

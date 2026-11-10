import type { Todo, TodoRepeat } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { TodoVisibility } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
  type SavepointRunnerPort,
  type AfterCommitTaskRegistryPort,
} from "#api/shared/application/ports/index";

import { NotesMemoLogEvent } from "../notes-memo-log.events.js";
import type { MemoTodoCreatorPort } from "../ports/memo-todo-creator.port.js";
import { type MemoRepositoryPort } from "../ports/memo.repository.port.js";

export interface ConvertMemoToSingleTodoData {
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly repeat?: TodoRepeat | null;
  readonly usesLegacySeriesLimit?: boolean;
  readonly items?: { title: string }[];
}

export interface ConvertMemoToTodosData {
  readonly todos: ConvertMemoToSingleTodoData[];
}

export interface ConvertMemoToTodosResult {
  readonly message: string;
  readonly todos: Todo[];
}

export interface ConvertMemoToTodosInput {
  readonly userId: string;
  readonly memoId: number;
  readonly data: ConvertMemoToTodosData;
  readonly timezone: string | undefined;
}

interface ConvertMemoToTodosDependencies {
  readonly repository: Pick<MemoRepositoryPort, "findByIdAndUserId" | "delete">;
  readonly todoCreator: MemoTodoCreatorPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly savepointRunner: SavepointRunnerPort;
  readonly afterCommit: AfterCommitTaskRegistryPort;
  readonly logger: ApplicationLoggerPort;
}

export class ConvertMemoToTodos {
  readonly #dependencies: ConvertMemoToTodosDependencies;

  constructor(dependencies: ConvertMemoToTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ConvertMemoToTodosInput): Promise<ConvertMemoToTodosResult> {
    const { userId, memoId, data, timezone } = input;
    const outcome = await this.#dependencies.unitOfWork.run<
      { kind: "success"; todos: Todo[] } | { kind: "failed"; error: unknown }
    >(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.memo(memoId),
        MutationLockKeys.memoSortOrder(userId),
        MutationLockKeys.todoCategory(userId),
        MutationLockKeys.todoSortOrder(userId),
      ]);
      const memo = await this.#dependencies.repository.findByIdAndUserId(memoId, userId);
      if (memo == null) {
        throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
      }
      const todos: Todo[] = [];
      for (const todoDraft of data.todos) {
        try {
          const staged = await this.#dependencies.savepointRunner.run(() =>
            this.#dependencies.todoCreator.stage({
              userId,
              title: todoDraft.title,
              categoryId: todoDraft.categoryId,
              startDate: todoDraft.startDate,
              endDate: todoDraft.endDate,
              scheduledTime: todoDraft.scheduledTime,
              timezone,
              isAllDay: todoDraft.isAllDay ?? true,
              visibility: todoDraft.visibility ?? "PUBLIC",
              items: todoDraft.items,
              repeat: todoDraft.repeat,
              usesLegacySeriesLimit: todoDraft.usesLegacySeriesLimit,
            }),
          );
          this.#dependencies.afterCommit.register(staged.afterCommit);
          todos.push(...staged.todos);
        } catch (error) {
          // 성공한 앞 항목은 실제로 커밋하고, 그 효과가 정착한 뒤 원래 오류를 전달한다.
          return { kind: "failed", error };
        }
      }
      await this.#dependencies.repository.delete(memoId);
      return { kind: "success", todos };
    });
    if (outcome.kind === "failed") {
      throw outcome.error;
    }
    this.#dependencies.logger.log({
      event: NotesMemoLogEvent.CONVERTED,
      memoId,
      userId,
      todoCount: outcome.todos.length,
    });
    return {
      message: `메모가 ${outcome.todos.length}개의 할 일로 변환되었습니다.`,
      todos: outcome.todos,
    };
  }
}

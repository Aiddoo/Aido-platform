import type { TodoCommentChainResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { ThreadPlacement } from "../../../domain/value-objects/comments/thread-placement.vo.js";
import { TodoCommentContent } from "../../../domain/value-objects/comments/todo-comment-content.vo.js";
import type {
  TodoCommentChainCommand,
  TodoCommentRecord,
} from "../../models/comments/todo-comment.types.js";
import { type TodoCommentNotificationPort } from "../../ports/comments/todo-comment-notification.port.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import {
  TodoCommentIdempotencyConflict,
  TodoCommentIdempotencyRace,
  type TodoCommentRepositoryPort,
} from "../../ports/comments/todo-comment.repository.port.js";
import { type TodoViewCachePort } from "../../ports/comments/todo-view-cache.port.js";
import { toTodoCommentResponse } from "../../presenters/comments/index.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";
import { settleAfterCommit } from "../../services/comments/settle-after-commit.js";

export interface WriteTodoCommentChainInput {
  todoId: number;
  authorId: string;
  parentId: string | null;
  items: { clientRequestId: string; content: string }[];
}

interface WriteOutcome {
  written: TodoCommentRecord[];
  likedCommentIds: ReadonlySet<string>;
  addedCount: number;
  recipientId: string;
  threadRootId: string;
}

function normalizeCommand(input: WriteTodoCommentChainInput): TodoCommentChainCommand {
  if (input.items.length === 0) {
    throw new ApplicationException(ErrorCode.SYS_0002);
  }

  return {
    todoId: input.todoId,
    authorId: input.authorId,
    parentId: input.parentId,
    items: input.items.map((item) => ({
      clientRequestId: item.clientRequestId,
      content: TodoCommentContent.create(item.content).getValue(),
    })),
  };
}

function requireFirst(records: readonly TodoCommentRecord[]): TodoCommentRecord {
  const first = records[0];
  if (first === undefined) {
    throw new ApplicationException(ErrorCode.SYS_0003);
  }

  return first;
}

function throwMappedWriteError(error: unknown): never {
  if (error instanceof TodoCommentIdempotencyConflict) {
    throw new ApplicationException(ErrorCode.SYS_0002);
  }

  throw error;
}

interface WriteTodoCommentChainDependencies {
  readonly reader: TodoCommentReaderPort;
  readonly repository: TodoCommentRepositoryPort;
  readonly notification: TodoCommentNotificationPort;
  readonly todoViewCache: TodoViewCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class WriteTodoCommentChain {
  readonly #dependencies: WriteTodoCommentChainDependencies;

  constructor(dependencies: WriteTodoCommentChainDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: WriteTodoCommentChainInput): Promise<TodoCommentChainResponse> {
    const command = normalizeCommand(input);
    const outcome = await this.resolveWrite(command);

    if (outcome.addedCount > 0) {
      const first = requireFirst(outcome.written);
      await settleAfterCommit(this.#dependencies.logger, [
        {
          label: "할 일 화면 캐시 무효화",
          run: () => this.#dependencies.todoViewCache.invalidateForTodo(input.todoId),
        },
        {
          label: "댓글 작성 알림",
          run: () =>
            this.#dependencies.notification.notifyCommentsWritten({
              recipientId: outcome.recipientId,
              senderId: input.authorId,
              senderName: first.authorName,
              todoId: input.todoId,
              commentId: first.id,
              threadRootId: outcome.threadRootId,
              isReply: input.parentId !== null,
              commentCount: outcome.addedCount,
            }),
        },
      ]);
    }

    return {
      comments: outcome.written.map((record) =>
        toTodoCommentResponse(record, input.authorId, outcome.likedCommentIds),
      ),
    };
  }

  private async resolveWrite(command: TodoCommentChainCommand): Promise<WriteOutcome> {
    try {
      return await this.write(command);
    } catch (error) {
      if (!(error instanceof TodoCommentIdempotencyRace)) {
        throwMappedWriteError(error);
      }

      try {
        return await this.replayAfterRace(command);
      } catch (replayError) {
        throwMappedWriteError(replayError);
      }
    }
  }

  private write(command: TodoCommentChainCommand): Promise<WriteOutcome> {
    return this.#dependencies.unitOfWork.run(async () => {
      const lockKeys = command.items.map((item) =>
        MutationLockKeys.todoCommentRequest(command.authorId, item.clientRequestId),
      );
      if (command.parentId !== null) {
        lockKeys.push(MutationLockKeys.todoComment(command.parentId));
      }

      await this.#dependencies.mutationLock.acquire(lockKeys);
      await assertTodoCommentAccess(this.#dependencies.reader, command.todoId, command.authorId);
      const replayIds = await this.#dependencies.repository.findCommentChainReplay(command);
      if (replayIds !== null) {
        return this.loadReplay(command, replayIds);
      }

      const parent =
        command.parentId === null
          ? null
          : await this.#dependencies.repository.findComment(command.todoId, command.parentId);
      if (command.parentId !== null && parent === null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: command.parentId });
      }

      const chain = await this.#dependencies.repository.createCommentChain({
        todoId: command.todoId,
        authorId: command.authorId,
        placement: parent === null ? ThreadPlacement.topLevel() : parent.placeReply(),
        items: command.items,
      });
      await this.#dependencies.repository.increaseTodoCommentCount(
        command.todoId,
        chain.createdCount,
      );

      if (
        parent !== null &&
        !(await this.#dependencies.repository.incrementReplyCount(parent.id.getValue()))
      ) {
        throw new ApplicationException(ErrorCode.SYS_0003, {
          commentId: parent.id.getValue(),
        });
      }

      const written = await this.#dependencies.reader.findCommentRecords(
        command.todoId,
        chain.commentIds,
      );
      const first = requireFirst(written);
      if (written.length !== chain.commentIds.length) {
        throw new ApplicationException(ErrorCode.SYS_0003);
      }

      return {
        written,
        likedCommentIds: new Set<string>(),
        addedCount: chain.createdCount,
        recipientId: parent === null ? first.todoOwnerId : parent.authorId,
        threadRootId: parent === null ? first.id : parent.threadRootId.getValue(),
      };
    });
  }

  /** unique 제약 위반으로 실패한 트랜잭션은 폐기하고 새 UoW에서 승자의 행을 읽는다. */
  private replayAfterRace(command: TodoCommentChainCommand): Promise<WriteOutcome> {
    return this.#dependencies.unitOfWork.run(async () => {
      const replayIds = await this.#dependencies.repository.findCommentChainReplay(command);
      if (replayIds === null) {
        throw new ApplicationException(ErrorCode.SYS_0003);
      }

      return this.loadReplay(command, replayIds);
    });
  }

  private async loadReplay(
    command: TodoCommentChainCommand,
    commentIds: readonly string[],
  ): Promise<WriteOutcome> {
    const written = await this.#dependencies.reader.findCommentRecords(command.todoId, commentIds);
    const first = requireFirst(written);
    if (written.length !== commentIds.length) {
      throw new TodoCommentIdempotencyConflict();
    }

    const likedCommentIds = await this.#dependencies.reader.findLikedCommentIds(
      commentIds,
      command.authorId,
    );
    return {
      written,
      likedCommentIds,
      addedCount: 0,
      recipientId: first.todoOwnerId,
      threadRootId: first.rootId ?? first.id,
    };
  }
}

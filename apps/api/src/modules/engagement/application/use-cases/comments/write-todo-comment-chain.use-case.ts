import type { TodoCommentChainResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { uniq } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import type { TodoComment } from "../../../domain/aggregates/comments/todo-comment.aggregate.js";
import { CommentPlacement } from "../../../domain/value-objects/comments/comment-placement.vo.js";
import { TodoCommentContent } from "../../../domain/value-objects/comments/todo-comment-content.vo.js";
import type {
  TodoCommentChainCommand,
  TodoCommentRecord,
} from "../../models/comments/todo-comment.types.js";
import { EngagementCommentLogEvent } from "../../observability/comments/engagement-comment-log.events.js";
import { type TodoCommentBlockReaderPort } from "../../ports/comments/todo-comment-block-reader.port.js";
import {
  type TodoCommentNotificationPort,
  type TodoCommentWrittenInput,
} from "../../ports/comments/todo-comment-notification.port.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import {
  TodoCommentIdempotencyConflict,
  TodoCommentIdempotencyRace,
  type TodoCommentRepositoryPort,
} from "../../ports/comments/todo-comment.repository.port.js";
import { type TodoViewCachePort } from "../../ports/comments/todo-view-cache.port.js";
import { toTodoCommentResponse } from "../../presenters/comments/v1/index.js";
import { assertNotBlocked } from "../../services/comments/assert-not-blocked.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";
import { settleAfterCommit } from "../../services/comments/settle-after-commit.js";

export interface WriteTodoCommentChainInput {
  readonly todoId: number;
  readonly authorId: string;
  readonly parentId: string | null;
  readonly items: readonly { readonly clientRequestId: string; readonly content: string }[];
}

interface WriteOutcome {
  readonly written: readonly TodoCommentRecord[];
  readonly likedCommentIds: ReadonlySet<string>;
  readonly addedCount: number;
  readonly recipientId: string;
  readonly threadRootId: string;
  readonly replyTarget: TodoCommentWrittenInput["replyTarget"];
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

function toReplyTargetKind(replyTarget: TodoComment | null): WriteOutcome["replyTarget"] {
  if (replyTarget == null) {
    return null;
  }

  return replyTarget.placement.kind;
}

function requireFirst(records: readonly TodoCommentRecord[]): TodoCommentRecord {
  const first = records[0];
  if (first == null) {
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
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "findCommentRecords" | "findLikedCommentIds"
  >;
  readonly repository: Pick<
    TodoCommentRepositoryPort,
    | "findCommentChainReplay"
    | "findComment"
    | "createCommentChain"
    | "increaseTodoCommentCount"
    | "increaseReplyCount"
  >;
  readonly notification: Pick<TodoCommentNotificationPort, "notifyCommentsWritten">;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
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
          failureEvent: EngagementCommentLogEvent.VIEW_CACHE_INVALIDATION_FAILED,
          context: { todoId: input.todoId, userId: input.authorId },
          run: () => this.#dependencies.todoViewCache.invalidateForTodo(input.todoId),
        },
        {
          failureEvent: EngagementCommentLogEvent.WRITE_NOTIFICATION_FAILED,
          context: { todoId: input.todoId, userId: input.authorId },
          run: () =>
            this.#dependencies.notification.notifyCommentsWritten({
              recipientId: outcome.recipientId,
              senderId: input.authorId,
              senderName: first.authorName,
              todoId: input.todoId,
              commentId: first.id,
              threadRootId: outcome.threadRootId,
              replyTarget: outcome.replyTarget,
              commentCount: outcome.addedCount,
            }),
        },
      ]);
    }

    return {
      comments: outcome.written.map((record) =>
        toTodoCommentResponse(record, {
          viewerId: input.authorId,
          likedCommentIds: outcome.likedCommentIds,
          blockedAuthorIds: new Set(),
        }),
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
      // 답글 수를 바꾸는 묶음 머리까지 삭제와 같은 순서로 한 번에 잠근다. 묶음 머리는 바뀌지 않는다.
      const target =
        command.parentId == null
          ? null
          : await this.#dependencies.repository.findComment(command.todoId, command.parentId);
      if (command.parentId != null && target == null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: command.parentId });
      }
      if (target != null) {
        lockKeys.push(
          ...uniq([target.id.getValue(), target.threadCommentId]).map(MutationLockKeys.todoComment),
        );
      }

      await this.#dependencies.mutationLock.acquire(lockKeys);
      await assertTodoCommentAccess(this.#dependencies.reader, command.todoId, command.authorId);
      const replayIds = await this.#dependencies.repository.findCommentChainReplay(command);
      if (replayIds != null) {
        return this.loadReplay(command, replayIds);
      }

      const replyTarget =
        command.parentId == null
          ? null
          : await this.#dependencies.repository.findComment(command.todoId, command.parentId);
      if (command.parentId != null && replyTarget == null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: command.parentId });
      }
      if (replyTarget != null) {
        await assertNotBlocked(
          this.#dependencies.blockReader,
          command.authorId,
          replyTarget.authorId,
        );
      }

      const thread = replyTarget == null ? null : await this.findThreadComment(replyTarget);
      const placement = replyTarget == null ? CommentPlacement.comment() : replyTarget.placeReply();
      const chain = await this.#dependencies.repository.createCommentChain({
        todoId: command.todoId,
        authorId: command.authorId,
        placement,
        items: command.items,
      });
      await this.#dependencies.repository.increaseTodoCommentCount(
        command.todoId,
        chain.createdCount,
      );

      if (thread != null) {
        thread.applyReplyAdded(chain.createdCount);
        if (
          !(await this.#dependencies.repository.increaseReplyCount(
            thread.id.getValue(),
            chain.createdCount,
          ))
        ) {
          throw new ApplicationException(ErrorCode.SYS_0003, { commentId: thread.id.getValue() });
        }
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
        recipientId: replyTarget == null ? first.todoOwnerId : replyTarget.authorId,
        threadRootId: replyTarget == null ? first.id : replyTarget.threadCommentId,
        replyTarget: toReplyTargetKind(replyTarget),
      };
    });
  }

  private async findThreadComment(replyTarget: TodoComment): Promise<TodoComment> {
    if (!replyTarget.isReply) {
      return replyTarget;
    }

    const thread = await this.#dependencies.repository.findComment(
      replyTarget.todoId,
      replyTarget.threadCommentId,
    );
    if (thread == null) {
      throw new ApplicationException(ErrorCode.SYS_0003, {
        commentId: replyTarget.threadCommentId,
      });
    }

    return thread;
  }

  /** unique 제약 위반으로 실패한 트랜잭션은 폐기하고 새 UoW에서 승자의 행을 읽는다. */
  private replayAfterRace(command: TodoCommentChainCommand): Promise<WriteOutcome> {
    return this.#dependencies.unitOfWork.run(async () => {
      await assertTodoCommentAccess(this.#dependencies.reader, command.todoId, command.authorId);
      const replayIds = await this.#dependencies.repository.findCommentChainReplay(command);
      if (replayIds == null) {
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
      recipientId: first.replyToAuthorId ?? first.todoOwnerId,
      threadRootId: first.threadCommentId ?? first.id,
      replyTarget: null,
    };
  }
}

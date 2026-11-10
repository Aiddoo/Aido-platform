import type { TodoCommentKind } from "@aido/api/vocabulary";
import { uniq } from "es-toolkit";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type {
  TodoEngagementCounterPort,
  TodoViewCacheInvalidatorPort,
} from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { CommentPlacement } from "../../domain/comment-placement.vo.js";
import {
  matchTodoCommentChainReplay,
  fingerprintTodoCommentChain,
  type TodoCommentChainRequest,
} from "../../domain/todo-comment-chain.domain-service.js";
import { TodoCommentContent } from "../../domain/todo-comment-content.vo.js";
import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { TodoComment } from "../../domain/todo-comment.aggregate.js";
import {
  blockedCounterpart,
  commentNotFound,
  commentStateConflict,
  invalidCommentRequest,
  todoNotFound,
  TodoCommentIdempotencyConflict,
  TodoCommentIdempotencyRace,
} from "../comments.errors.js";
import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import { settleAfterCommit, TodoCommentLogEvent } from "../comments.log-events.js";
import type { TodoCommentBlockReaderPort } from "../ports/todo-comment-block-reader.port.js";
import type { TodoCommentNotificationPort } from "../ports/todo-comment-notification.port.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type { TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";
import type {
  TodoCommentReadModel,
  TodoCommentsWithViewer,
} from "../read-models/todo-comment.read-model.js";

export interface WriteTodoCommentChainCommand {
  readonly todoId: number;
  readonly authorId: string;
  readonly parentId: string | null;
  readonly items: readonly { readonly clientRequestId: string; readonly content: string }[];
}

interface WriteOutcome {
  readonly written: readonly TodoCommentReadModel[];
  readonly likedCommentIds: ReadonlySet<string>;
  readonly addedCount: number;
  readonly recipientId: string;
  readonly threadRootId: string;
  readonly replyTarget: TodoCommentKind | null;
}

interface WriteTodoCommentChainDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "listComments" | "listLikedCommentIds"
  >;
  readonly repository: Pick<
    TodoCommentRepositoryPort,
    "nextId" | "findByIdAndTodoId" | "listByAuthorIdAndClientRequestIds" | "save"
  >;
  readonly engagementCounter: Pick<TodoEngagementCounterPort, "increaseCommentCount">;
  readonly notification: Pick<TodoCommentNotificationPort, "notifyCommentsWritten">;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly todoViewCache: Pick<TodoViewCacheInvalidatorPort, "invalidateForTodo">;
  readonly logger: ApplicationLoggerPort;
}

function toRequest(command: WriteTodoCommentChainCommand): TodoCommentChainRequest {
  if (command.items.length === 0) {
    throw invalidCommentRequest();
  }
  return {
    todoId: command.todoId,
    authorId: command.authorId,
    parentId: command.parentId,
    items: command.items.map((item) => ({
      clientRequestId: item.clientRequestId,
      content: TodoCommentContent.create(item.content).value,
    })),
  };
}

function requireFirst(comments: readonly TodoCommentReadModel[]): TodoCommentReadModel {
  const first = comments[0];
  if (first == null) {
    throw commentStateConflict();
  }
  return first;
}

function toWriteError(error: unknown): unknown {
  return error instanceof TodoCommentIdempotencyConflict ? invalidCommentRequest() : error;
}

/** 이어 쓴 글은 모두 같은 묶음에 붙고 각자 바로 앞 글에 답한다. 같은 멱등 키로 다시 보내면 원래 글을 돌려준다 */
export class WriteTodoCommentChainUseCase {
  readonly #dependencies: WriteTodoCommentChainDependencies;

  constructor(dependencies: WriteTodoCommentChainDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: WriteTodoCommentChainCommand): Promise<TodoCommentsWithViewer> {
    const { notification, todoViewCache, logger } = this.#dependencies;
    const request = toRequest(command);
    const outcome = await this.#resolveWrite(request);

    if (outcome.addedCount > 0) {
      const first = requireFirst(outcome.written);
      const context = { todoId: command.todoId, userId: command.authorId };
      await settleAfterCommit(logger, [
        {
          failureEvent: TodoCommentLogEvent.VIEW_CACHE_INVALIDATION_FAILED,
          context,
          run: () => todoViewCache.invalidateForTodo(command.todoId),
        },
        {
          failureEvent: TodoCommentLogEvent.WRITE_NOTIFICATION_FAILED,
          context,
          run: () =>
            notification.notifyCommentsWritten({
              recipientId: outcome.recipientId,
              senderId: command.authorId,
              senderName: first.authorName,
              todoId: command.todoId,
              commentId: first.id,
              threadRootId: outcome.threadRootId,
              replyTarget: outcome.replyTarget,
              commentCount: outcome.addedCount,
            }),
        },
      ]);
    }

    return {
      comments: outcome.written,
      viewer: {
        viewerId: command.authorId,
        likedCommentIds: outcome.likedCommentIds,
        blockedAuthorIds: new Set(),
      },
    };
  }

  async #resolveWrite(request: TodoCommentChainRequest): Promise<WriteOutcome> {
    try {
      return await this.#write(request);
    } catch (error) {
      if (!(error instanceof TodoCommentIdempotencyRace)) {
        throw toWriteError(error);
      }
    }
    try {
      return await this.#replayAfterRace(request);
    } catch (error) {
      throw toWriteError(error);
    }
  }

  #write(request: TodoCommentChainRequest): Promise<WriteOutcome> {
    const { unitOfWork, mutationLock, repository, blockReader } = this.#dependencies;
    const todoId = TodoId.reconstitute(request.todoId);
    const authorId = UserId.reconstitute(request.authorId);
    const parentId = request.parentId == null ? null : TodoCommentId.reconstitute(request.parentId);
    return unitOfWork.run(async () => {
      const lockKeys = request.items.map((item) =>
        TodoCommentLockKeys.request(request.authorId, item.clientRequestId),
      );
      // 답글 수를 바꾸는 묶음 머리까지 삭제와 같은 순서로 한 번에 잠근다. 묶음 머리는 바뀌지 않는다
      const target = parentId == null ? null : await repository.findByIdAndTodoId(parentId, todoId);
      if (parentId != null && target == null) {
        throw commentNotFound(parentId.value);
      }
      if (target != null) {
        lockKeys.push(
          ...uniq([target.id.value, target.threadCommentId.value]).map(TodoCommentLockKeys.comment),
        );
      }
      await mutationLock.acquire(lockKeys);
      await this.#assertAccess(request);
      const replayIds = await this.#findReplay(request);
      if (replayIds != null) {
        return this.#loadReplay(request, replayIds);
      }

      const replyTarget =
        parentId == null ? null : await repository.findByIdAndTodoId(parentId, todoId);
      if (parentId != null && replyTarget == null) {
        throw commentNotFound(parentId.value);
      }
      if (replyTarget != null) {
        const blockedIds = await blockReader.findBlockedCounterpartIds(authorId, [
          replyTarget.authorId,
        ]);
        if (blockedIds.has(replyTarget.authorId.value)) {
          throw blockedCounterpart();
        }
      }
      const thread = replyTarget == null ? null : await this.#findThread(replyTarget);
      const placement =
        replyTarget == null ? CommentPlacement.create(null) : replyTarget.placeReply();
      const created = await this.#createChain(request, placement);
      await this.#dependencies.engagementCounter.increaseCommentCount(
        request.todoId,
        created.length,
      );
      if (thread != null) {
        thread.addReplies(created.length, this.#dependencies.clock.now());
        await repository.save(thread);
      }

      const commentIds = created.map((comment) => comment.id);
      const written = await this.#dependencies.reader.listComments(todoId, commentIds);
      const first = requireFirst(written);
      if (written.length !== commentIds.length) {
        throw commentStateConflict();
      }
      return {
        written,
        likedCommentIds: new Set<string>(),
        addedCount: created.length,
        recipientId: replyTarget == null ? first.todoOwnerId : replyTarget.authorId.value,
        threadRootId: replyTarget == null ? first.id : replyTarget.threadCommentId.value,
        replyTarget: replyTarget?.placement.kind ?? null,
      };
    });
  }

  // 묶음 안 답글은 작성 시각 순서라 같은 시각에 1ms씩 더해 쓴 순서를 남긴다
  async #createChain(
    request: TodoCommentChainRequest,
    firstPlacement: CommentPlacement,
  ): Promise<TodoComment[]> {
    const { repository, clock } = this.#dependencies;
    const now = clock.now().round({ smallestUnit: "millisecond", roundingMode: "floor" });
    const authorId = UserId.reconstitute(request.authorId);
    const requestFingerprint = fingerprintTodoCommentChain(request);
    const created: TodoComment[] = [];
    let placement = firstPlacement;
    for (const [index, item] of request.items.entries()) {
      const comment = TodoComment.create({
        id: await repository.nextId(),
        todoId: request.todoId,
        authorId,
        placement,
        content: TodoCommentContent.reconstitute(item.content),
        clientRequestId: item.clientRequestId,
        requestFingerprint,
        createdAt: now.add({ milliseconds: index }),
      });
      if (index === 0 && !placement.isReply && request.items.length > 1) {
        comment.addReplies(request.items.length - 1, now);
      }
      await repository.save(comment);
      created.push(comment);
      placement = CommentPlacement.create({ id: comment.id.value, placement });
    }
    return created;
  }

  async #assertAccess(request: TodoCommentChainRequest): Promise<void> {
    const todoOwnerId = await this.#dependencies.reader.findAccessibleTodoOwnerId(
      TodoId.reconstitute(request.todoId),
      UserId.reconstitute(request.authorId),
    );
    if (todoOwnerId == null) {
      throw todoNotFound(request.todoId);
    }
  }

  async #findReplay(request: TodoCommentChainRequest): Promise<readonly string[] | null> {
    const stored = await this.#dependencies.repository.listByAuthorIdAndClientRequestIds(
      UserId.reconstitute(request.authorId),
      request.items.map((item) => item.clientRequestId),
    );
    const replay = matchTodoCommentChainReplay({ request, stored });
    if (!replay.ok) {
      throw new TodoCommentIdempotencyConflict();
    }
    return replay.commentIds;
  }

  async #findThread(replyTarget: TodoComment): Promise<TodoComment> {
    if (!replyTarget.isReply) {
      return replyTarget;
    }
    const thread = await this.#dependencies.repository.findByIdAndTodoId(
      replyTarget.threadCommentId,
      TodoId.reconstitute(replyTarget.todoId),
    );
    if (thread == null) {
      throw commentStateConflict(replyTarget.threadCommentId.value);
    }
    return thread;
  }

  /** 유니크 제약 위반으로 실패한 트랜잭션은 버리고 새 UoW에서 먼저 저장한 요청의 글을 읽는다 */
  #replayAfterRace(request: TodoCommentChainRequest): Promise<WriteOutcome> {
    return this.#dependencies.unitOfWork.run(async () => {
      await this.#assertAccess(request);
      const replayIds = await this.#findReplay(request);
      if (replayIds == null) {
        throw commentStateConflict();
      }
      return this.#loadReplay(request, replayIds);
    });
  }

  async #loadReplay(
    request: TodoCommentChainRequest,
    commentIds: readonly string[],
  ): Promise<WriteOutcome> {
    const { reader } = this.#dependencies;
    const ids = commentIds.map((commentId) => TodoCommentId.reconstitute(commentId));
    const written = await reader.listComments(TodoId.reconstitute(request.todoId), ids);
    const first = requireFirst(written);
    if (written.length !== commentIds.length) {
      throw new TodoCommentIdempotencyConflict();
    }
    const likedCommentIds = await reader.listLikedCommentIds(
      ids,
      UserId.reconstitute(request.authorId),
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

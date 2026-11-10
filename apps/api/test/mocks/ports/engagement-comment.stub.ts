import { ErrorCode } from "@aido/api/errors";

import type { TodoCommentBlockReaderPort } from "#api/modules/engagement/comments/application/ports/todo-comment-block-reader.port";
import type {
  TodoCommentActivityNotificationInput,
  TodoCommentWrittenInput,
  TodoCommentNotificationPort,
} from "#api/modules/engagement/comments/application/ports/todo-comment-notification.port";
import type { TodoCommentReaderPort } from "#api/modules/engagement/comments/application/ports/todo-comment.reader.port";
import {
  TodoCommentIdempotencyConflict,
  type TodoCommentRepositoryPort,
} from "#api/modules/engagement/comments/application/ports/todo-comment.repository.port";
import type {
  CreateTodoCommentChainInput,
  TodoCommentChainCommand,
  TodoCommentRecord,
  TodoCommentLikeTransition,
  TodoConversationWindow,
  TodoCommentThreadItemRecord,
  TodoCommentWindow,
  TodoDetailsRecord,
  ListTodoConversationParams,
  ListTodoCommentRepliesParams,
  ListTodoCommentThreadsParams,
} from "#api/modules/engagement/comments/application/read-models/todo-comment.read-model";
import { CommentPlacement } from "#api/modules/engagement/comments/domain/comment-placement.vo";
import { TodoComment } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import type { TodoCommentState } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import { ApplicationException } from "#api/shared/application/application.exception";

interface LikeState {
  isLiked: boolean;
  wasEverNotified: boolean;
}
interface ReplayState {
  command: TodoCommentChainCommand;
  commentIds: string[];
}

export class StubEngagementCommentRepository implements TodoCommentRepositoryPort {
  readonly comments = new Map<string, TodoCommentState>();
  readonly likes = new Map<string, LikeState>();
  readonly commentCounts = new Map<number, number>();
  readonly viewCounts = new Map<number, number>();
  readonly views = new Set<string>();
  readonly replays = new Map<string, ReplayState>();
  readonly likeCounts = new Map<string, number>();
  #nextCommentId = 0;

  seed(comment: TodoCommentState): void {
    this.comments.set(comment.id, structuredClone(comment));
  }
  async findComment(todoId: number, commentId: string): Promise<TodoComment | null> {
    const comment = this.comments.get(commentId);
    return comment?.todoId === todoId ? TodoComment.reconstitute(comment) : null;
  }
  async findCommentChainReplay(command: TodoCommentChainCommand): Promise<string[] | null> {
    const stored = command.items.map((item) =>
      this.replays.get(`${command.authorId}:${item.clientRequestId}`),
    );
    if (stored.every((replay) => replay === undefined)) {
      return null;
    }
    const replay = stored[0];
    if (
      replay === undefined ||
      stored.some(
        (entry) => entry === undefined || JSON.stringify(entry.command) !== JSON.stringify(command),
      )
    ) {
      throw new TodoCommentIdempotencyConflict();
    }
    return [...replay.commentIds];
  }
  async createCommentChain(input: CreateTodoCommentChainInput) {
    let placement = input.placement;
    const commentIds: string[] = [];
    for (const item of input.items) {
      const id = `c${(++this.#nextCommentId).toString(36).padStart(24, "0")}`;
      const at = new Date();
      this.seed({
        id,
        todoId: input.todoId,
        authorId: input.authorId,
        parentId: placement.kind === "COMMENT" ? null : placement.threadCommentId,
        replyToCommentId: placement.kind === "COMMENT" ? null : placement.replyToCommentId,
        content: item.content,
        replyCount: placement.kind === "COMMENT" ? input.items.length - 1 : 0,
        deletedAt: null,
        editedAt: null,
        createdAt: at,
        updatedAt: at,
      });
      const created = this.comments.get(id);
      if (created === undefined) {
        throw new Error("댓글 fixture 저장 실패");
      }
      placement = CommentPlacement.replyTo({ id: created.id, placement });
      commentIds.push(id);
    }
    const command = {
      todoId: input.todoId,
      authorId: input.authorId,
      parentId: input.placement.kind === "COMMENT" ? null : input.placement.replyToCommentId,
      items: structuredClone(input.items),
    };
    for (const item of input.items) {
      this.replays.set(`${input.authorId}:${item.clientRequestId}`, {
        command,
        commentIds: [...commentIds],
      });
    }
    return { commentIds, createdCount: commentIds.length };
  }
  async updateComment(comment: TodoComment): Promise<boolean> {
    if (!this.comments.has(comment.id.getValue())) {
      return false;
    }
    this.seed(comment.snapshot);
    return true;
  }
  async deleteComment(comment: TodoComment): Promise<boolean> {
    return this.updateComment(comment);
  }
  async increaseTodoCommentCount(todoId: number, amount: number): Promise<void> {
    this.commentCounts.set(todoId, (this.commentCounts.get(todoId) ?? 0) + amount);
  }
  async decrementTodoCommentCount(todoId: number): Promise<boolean> {
    const count = this.commentCounts.get(todoId) ?? 0;
    if (count === 0) {
      return false;
    }
    this.commentCounts.set(todoId, count - 1);
    return true;
  }
  async increaseReplyCount(commentId: string, amount: number): Promise<boolean> {
    const comment = this.comments.get(commentId);
    if (comment === undefined || comment.parentId !== null) {
      return false;
    }
    this.seed({ ...comment, replyCount: comment.replyCount + amount });
    return true;
  }
  async decreaseReplyCount(commentId: string): Promise<boolean> {
    const comment = this.comments.get(commentId);
    if (comment === undefined || comment.parentId !== null || comment.replyCount === 0) {
      return false;
    }
    this.seed({ ...comment, replyCount: comment.replyCount - 1 });
    return true;
  }
  async setLike(
    todoId: number,
    commentId: string,
    userId: string,
  ): Promise<TodoCommentLikeTransition> {
    return this.#setLike(todoId, commentId, userId, true);
  }
  async removeLike(
    todoId: number,
    commentId: string,
    userId: string,
  ): Promise<TodoCommentLikeTransition> {
    return this.#setLike(todoId, commentId, userId, false);
  }
  async markLikeNotified(commentId: string, userId: string): Promise<void> {
    const like = this.likes.get(`${commentId}:${userId}`);
    if (like === undefined || !like.isLiked || like.wasEverNotified) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId });
    }
    like.wasEverNotified = true;
  }
  async findPendingLikeNotification(todoId: number, commentId: string, userId: string) {
    const comment = this.comments.get(commentId);
    const like = this.likes.get(`${commentId}:${userId}`);
    return comment?.todoId === todoId &&
      comment.deletedAt === null &&
      like?.isLiked === true &&
      !like.wasEverNotified
      ? { recipientId: comment.authorId, threadRootId: comment.parentId ?? comment.id }
      : null;
  }
  async recordView(todoId: number, viewerId: string) {
    const key = `${todoId}:${viewerId}`;
    const recorded = !this.views.has(key);
    this.views.add(key);
    const viewCount = (this.viewCounts.get(todoId) ?? 0) + Number(recorded);
    this.viewCounts.set(todoId, viewCount);
    return { recorded, viewCount };
  }
  #setLike(
    todoId: number,
    commentId: string,
    userId: string,
    isLiked: boolean,
  ): TodoCommentLikeTransition {
    const comment = this.comments.get(commentId);
    if (comment?.todoId !== todoId) {
      throw new ApplicationException(ErrorCode.TODO_0831, { commentId });
    }
    const key = `${commentId}:${userId}`;
    const previous = this.likes.get(key) ?? { isLiked: false, wasEverNotified: false };
    const changed = previous.isLiked !== isLiked;
    const likeCount = (this.likeCounts.get(commentId) ?? 0) + (changed ? (isLiked ? 1 : -1) : 0);
    this.likes.set(key, { ...previous, isLiked });
    this.likeCounts.set(commentId, likeCount);
    return {
      commentId,
      commentAuthorId: comment.authorId,
      changed,
      isLiked,
      likeCount,
      wasEverNotified: previous.wasEverNotified,
    };
  }
}

export class StubEngagementCommentReader implements TodoCommentReaderPort {
  readonly accessiblePairs = new Set<string>();
  readonly names = new Map<string, string | null>();
  readonly todoOwners = new Map<number, string>();
  readonly details = new Map<number, TodoDetailsRecord>();
  conversationWindow: TodoConversationWindow | null = null;
  threadsWindow: TodoCommentWindow<TodoCommentThreadItemRecord> | null = null;
  repliesWindow: TodoCommentWindow<TodoCommentRecord> | null = null;
  likedCommentIds: Set<string> | undefined;
  constructor(readonly repository: StubEngagementCommentRepository) {}
  async findAccessibleTodoOwnerId(todoId: number, viewerId: string) {
    if (!this.accessiblePairs.has(`${todoId}:${viewerId}`)) {
      return null;
    }
    return this.todoOwners.get(todoId) ?? viewerId;
  }
  async findAccessibleTodoDetails(todoId: number, viewerId: string) {
    const record = this.details.get(todoId);
    return record !== undefined && (await this.findAccessibleTodoOwnerId(todoId, viewerId)) != null
      ? { ...structuredClone(record), isOwner: record.owner.id === viewerId }
      : null;
  }
  async findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentRecord | null> {
    const comment = this.repository.comments.get(commentId);
    if (comment?.todoId !== todoId) {
      return null;
    }
    const replyTarget =
      comment.replyToCommentId == null
        ? undefined
        : this.repository.comments.get(comment.replyToCommentId);
    return {
      id: comment.id,
      todoId,
      authorId: comment.authorId,
      authorName: this.names.get(comment.authorId) ?? null,
      authorUserTag: null,
      authorProfileImage: null,
      todoOwnerId: this.todoOwners.get(todoId) ?? comment.authorId,
      threadCommentId: comment.parentId,
      replyToCommentId: comment.replyToCommentId,
      replyToAuthorId: replyTarget?.authorId ?? null,
      replyToAuthorName:
        replyTarget == null ? null : (this.names.get(replyTarget.authorId) ?? null),
      content: comment.content,
      likeCount: this.repository.likeCounts.get(comment.id) ?? 0,
      replyCount: comment.replyCount,
      deletedAt: comment.deletedAt?.toISOString() ?? null,
      editedAt: comment.editedAt?.toISOString() ?? null,
      createdAt: comment.createdAt.toISOString(),
    };
  }
  async findCommentRecords(todoId: number, ids: readonly string[]) {
    const records = await Promise.all(ids.map((id) => this.findCommentRecord(todoId, id)));
    return records.filter((record) => record !== null);
  }
  async listConversation(_params: ListTodoConversationParams) {
    return structuredClone(this.conversationWindow);
  }
  async listThreads(_params: ListTodoCommentThreadsParams) {
    return structuredClone(this.threadsWindow);
  }
  async listReplies(_params: ListTodoCommentRepliesParams) {
    return structuredClone(this.repliesWindow);
  }
  async findLikedCommentIds(ids: readonly string[], viewerId: string) {
    return this.likedCommentIds === undefined
      ? new Set(
          ids.filter((id) => this.repository.likes.get(`${id}:${viewerId}`)?.isLiked === true),
        )
      : new Set(this.likedCommentIds);
  }
  async findUserDisplayName(userId: string) {
    return this.names.get(userId) ?? null;
  }
}

/** 차단 쌍을 방향과 상관없이 기억하는 댓글 차단 reader */
export class StubTodoCommentBlockReader implements TodoCommentBlockReaderPort {
  readonly blockedPairs = new Set<string>();

  block(blockerId: string, blockedId: string): void {
    this.blockedPairs.add(`${blockerId}:${blockedId}`);
  }

  async findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    return new Set(
      candidateUserIds.filter(
        (userId) =>
          this.blockedPairs.has(`${viewerId}:${userId}`) ||
          this.blockedPairs.has(`${userId}:${viewerId}`),
      ),
    );
  }
}

export class StubEngagementCommentNotification implements TodoCommentNotificationPort {
  readonly written: TodoCommentWrittenInput[] = [];
  readonly liked: TodoCommentActivityNotificationInput[] = [];
  async notifyCommentsWritten(input: TodoCommentWrittenInput) {
    this.written.push(structuredClone(input));
  }
  async notifyCommentLiked(input: TodoCommentActivityNotificationInput) {
    this.liked.push(structuredClone(input));
  }
}

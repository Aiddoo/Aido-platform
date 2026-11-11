import {
  type ListTodoCommentRepliesParams,
  type ListTodoCommentThreadsParams,
  type ListTodoConversationParams,
  TodoCommentReaderPort,
} from "#api/modules/engagement/comments/application/ports/todo-comment.reader.port";
import type {
  TodoCommentReadModel,
  TodoCommentThreadItemReadModel,
  TodoCommentWindow,
  TodoConversationWindow,
  TodoDetailsReadModel,
} from "#api/modules/engagement/comments/application/read-models/todo-comment.read-model";
import type { TodoCommentId } from "#api/modules/engagement/comments/domain/todo-comment-id.vo";
import type { TodoComment } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryTodoCommentLikeRepository } from "./in-memory-todo-comment-like.repository.js";
import type { InMemoryTodoCommentRepository } from "./in-memory-todo-comment.repository.js";

/**
 * 글·좋아요는 InMemory 저장소에서 읽고, 접근 권한·이름·목록 창은 테스트가 정한다.
 * 목록 창의 keyset 의미는 Drizzle reader를 실제 PostgreSQL로 검증한다.
 */
export class FakeTodoCommentReader extends TodoCommentReaderPort {
  readonly names = new Map<string, string | null>();
  readonly details = new Map<number, TodoDetailsReadModel>();
  readonly threadParams: ListTodoCommentThreadsParams[] = [];
  readonly replyParams: ListTodoCommentRepliesParams[] = [];
  readonly conversationParams: ListTodoConversationParams[] = [];
  threadsWindow: TodoCommentWindow<TodoCommentThreadItemReadModel> | null = null;
  repliesWindow: TodoCommentWindow<TodoCommentReadModel> | null = null;
  conversationWindow: TodoConversationWindow | null = null;
  /** 기준 묶음·답글을 찾지 못한 것처럼 기준이 있는 조회에 null을 준다 */
  isAnchorMissing = false;
  readonly #access = new Map<number, { ownerId: string; viewerIds: Set<string> }>();
  readonly #comments: InMemoryTodoCommentRepository;
  readonly #likes: InMemoryTodoCommentLikeRepository;

  constructor(comments: InMemoryTodoCommentRepository, likes: InMemoryTodoCommentLikeRepository) {
    super();
    this.#comments = comments;
    this.#likes = likes;
  }

  /** 주인과 볼 수 있는 친구를 정한다. 주인은 늘 볼 수 있다 */
  grantAccess(todoId: number, ownerId: string, viewerIds: readonly string[] = []): void {
    this.#access.set(todoId, { ownerId, viewerIds: new Set([ownerId, ...viewerIds]) });
  }

  revokeAccess(todoId: number, viewerId: string): void {
    this.#access.get(todoId)?.viewerIds.delete(viewerId);
  }

  async findAccessibleTodoDetails(
    todoId: TodoId,
    viewerId: UserId,
  ): Promise<TodoDetailsReadModel | null> {
    const details = this.details.get(todoId.value);
    if (details == null || (await this.findAccessibleTodoOwnerId(todoId, viewerId)) == null) {
      return null;
    }
    return { ...details, isOwner: details.owner.id === viewerId.value };
  }

  async findAccessibleTodoOwnerId(todoId: TodoId, viewerId: UserId): Promise<string | null> {
    const access = this.#access.get(todoId.value);
    return access?.viewerIds.has(viewerId.value) === true ? access.ownerId : null;
  }

  async findComment(
    todoId: TodoId,
    commentId: TodoCommentId,
  ): Promise<TodoCommentReadModel | null> {
    const [comment] = await this.listComments(todoId, [commentId]);
    return comment ?? null;
  }

  async listComments(
    todoId: TodoId,
    commentIds: readonly TodoCommentId[],
  ): Promise<TodoCommentReadModel[]> {
    const stored = new Map(this.#comments.list().map((comment) => [comment.id.value, comment]));
    return commentIds.flatMap((commentId) => {
      const comment = stored.get(commentId.value);
      return comment == null || comment.todoId !== todoId.value
        ? []
        : [this.#toReadModel(comment, stored)];
    });
  }

  async listThreads(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindow<TodoCommentThreadItemReadModel> | null> {
    this.threadParams.push(params);
    return params.mode !== "INITIAL" && this.isAnchorMissing ? null : this.threadsWindow;
  }

  async listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindow<TodoCommentReadModel> | null> {
    this.replyParams.push(params);
    return params.mode !== "INITIAL" && this.isAnchorMissing ? null : this.repliesWindow;
  }

  async listConversation(
    params: ListTodoConversationParams,
  ): Promise<TodoConversationWindow | null> {
    this.conversationParams.push(params);
    return this.conversationWindow;
  }

  async listLikedCommentIds(
    commentIds: readonly TodoCommentId[],
    viewerId: UserId,
  ): Promise<ReadonlySet<string>> {
    const requested = new Set(commentIds.map((commentId) => commentId.value));
    return new Set(
      this.#likes
        .list()
        .filter(
          (like) =>
            like.isActive && like.userId.equals(viewerId) && requested.has(like.commentId.value),
        )
        .map((like) => like.commentId.value),
    );
  }

  async findUserDisplayName(userId: UserId): Promise<string | null> {
    return this.names.get(userId.value) ?? null;
  }

  #toReadModel(comment: TodoComment, stored: Map<string, TodoComment>): TodoCommentReadModel {
    const primitives = comment.toPrimitives();
    const replyTarget =
      primitives.replyToCommentId == null ? undefined : stored.get(primitives.replyToCommentId);
    return {
      id: primitives.id,
      todoId: primitives.todoId,
      threadCommentId: primitives.parentId,
      replyToCommentId: primitives.replyToCommentId,
      replyToAuthorId: replyTarget?.authorId.value ?? null,
      replyToAuthorName:
        replyTarget == null ? null : (this.names.get(replyTarget.authorId.value) ?? null),
      authorId: primitives.authorId,
      authorName: this.names.get(primitives.authorId) ?? null,
      authorUserTag: null,
      authorProfileImage: null,
      todoOwnerId: this.#access.get(primitives.todoId)?.ownerId ?? primitives.authorId,
      content: primitives.content,
      likeCount: primitives.likeCount,
      replyCount: primitives.replyCount,
      deletedAt: primitives.deletedAt,
      editedAt: primitives.editedAt,
      createdAt: primitives.createdAt,
    };
  }
}

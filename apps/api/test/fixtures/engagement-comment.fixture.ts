import type {
  TodoCommentRecord,
  TodoConversationRecord,
  TodoConversationCursor,
  TodoCommentRepliesCursor,
  TodoCommentThreadCursor,
  TodoCommentViewerContext,
} from "#api/modules/engagement/application/models/comments/todo-comment.types";
import type { TodoCommentCursorCodecPort } from "#api/modules/engagement/application/ports/comments/todo-comment-cursor-codec.port";
import type { TodoViewCachePort } from "#api/modules/engagement/application/ports/comments/todo-view-cache.port";
import type { TodoCommentState } from "#api/modules/engagement/domain/records/comments/todo-comment.record";
import type { MutationLockPort } from "#api/shared/application/ports/index";
import { FakeLogger } from "#test/mocks/fake-logger.service";
import {
  StubEngagementCommentRepository,
  StubEngagementCommentReader,
  StubEngagementCommentNotification,
  StubTodoCommentBlockReader,
} from "#test/mocks/ports/engagement-comment.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

export const ENGAGEMENT_TIME = new Date("2026-08-26T00:00:00.000Z");
export const ENGAGEMENT_OWNER_ID = "cmowner000000000000000001";
export const ENGAGEMENT_VIEWER_ID = "cmviewer00000000000000001";

export function createCommentRecordFixture(
  overrides: Partial<TodoCommentRecord> = {},
): TodoCommentRecord {
  return {
    id: "cm1rootcomment000000000001",
    todoId: 1,
    threadCommentId: null,
    replyToCommentId: null,
    replyToAuthorId: null,
    replyToAuthorName: null,
    authorId: ENGAGEMENT_OWNER_ID,
    authorName: "작성자",
    authorUserTag: null,
    authorProfileImage: null,
    todoOwnerId: ENGAGEMENT_OWNER_ID,
    content: "댓글",
    likeCount: 0,
    replyCount: 0,
    deletedAt: null,
    editedAt: null,
    createdAt: ENGAGEMENT_TIME.toISOString(),
    ...overrides,
  };
}
export function createConversationRecordFixture(
  overrides: Partial<TodoConversationRecord> = {},
): TodoConversationRecord {
  return {
    ...createCommentRecordFixture(overrides),
    conversationPosition: { rootLikeCount: 0, rootReplyCount: 0 },
    ...overrides,
  };
}

export function createViewerContextFixture(
  overrides: Partial<TodoCommentViewerContext> = {},
): TodoCommentViewerContext {
  return {
    viewerId: ENGAGEMENT_VIEWER_ID,
    likedCommentIds: new Set(),
    blockedAuthorIds: new Set(),
    ...overrides,
  };
}

export function createEngagementCommentFixture() {
  const repository = new StubEngagementCommentRepository();
  const reader = new StubEngagementCommentReader(repository);
  reader.accessiblePairs.add(`1:${ENGAGEMENT_OWNER_ID}`);
  reader.accessiblePairs.add(`1:${ENGAGEMENT_VIEWER_ID}`);
  reader.todoOwners.set(1, ENGAGEMENT_OWNER_ID);
  reader.names.set(ENGAGEMENT_OWNER_ID, "작성자");
  reader.names.set(ENGAGEMENT_VIEWER_ID, "방문자");
  const notification = new StubEngagementCommentNotification();
  const blockReader = new StubTodoCommentBlockReader();
  const invalidatedTodoIds: number[] = [];
  const todoViewCache: TodoViewCachePort = {
    async invalidateForTodo(todoId) {
      invalidatedTodoIds.push(todoId);
    },
  };
  const mutationLock: MutationLockPort = { async acquire(_keys) {} };
  const unitOfWork = createUnitOfWorkMock();
  const logger = new FakeLogger();
  let nextCommentId = 0;
  const addComment = (overrides: Partial<TodoCommentState> = {}) => {
    const at = new Date();
    const state: TodoCommentState = {
      id: `c${(++nextCommentId).toString(36).padStart(24, "a")}`,
      todoId: 1,
      authorId: ENGAGEMENT_OWNER_ID,
      parentId: null,
      replyToCommentId: null,
      content: "댓글 원문",
      replyCount: 0,
      deletedAt: null,
      editedAt: null,
      createdAt: at,
      updatedAt: at,
      ...overrides,
    };
    repository.seed(state);
    repository.commentCounts.set(
      state.todoId,
      (repository.commentCounts.get(state.todoId) ?? 0) + 1,
    );
    return state;
  };
  return {
    repository,
    reader,
    notification,
    blockReader,
    todoViewCache,
    mutationLock,
    unitOfWork,
    logger,
    invalidatedTodoIds,
    addComment,
  };
}

export class StubEngagementCursorCodec implements TodoCommentCursorCodecPort {
  decodedConversation: TodoConversationCursor | undefined;
  decodedThreads: TodoCommentThreadCursor | undefined;
  decodedReplies: TodoCommentRepliesCursor | undefined;
  encodedConversations = ["previous", "next"];
  encodedThreads = ["previous", "next"];
  encodedReplies = ["previous", "next"];
  decodeConversation() {
    if (this.decodedConversation === undefined) {
      throw new Error("대화 cursor fixture가 준비되지 않았습니다.");
    }
    return structuredClone(this.decodedConversation);
  }
  decodeThreads() {
    if (this.decodedThreads === undefined) {
      throw new Error("묶음 cursor fixture가 준비되지 않았습니다.");
    }
    return structuredClone(this.decodedThreads);
  }
  decodeReplies() {
    if (this.decodedReplies === undefined) {
      throw new Error("답글 cursor fixture가 준비되지 않았습니다.");
    }
    return structuredClone(this.decodedReplies);
  }
  encodeConversation() {
    const cursor = this.encodedConversations.shift();
    if (cursor === undefined) {
      throw new Error("대화 cursor 응답 fixture가 준비되지 않았습니다.");
    }
    return cursor;
  }
  encodeThreads(..._args: Parameters<TodoCommentCursorCodecPort["encodeThreads"]>) {
    const cursor = this.encodedThreads.shift();
    if (cursor === undefined) {
      throw new Error("묶음 cursor 응답 fixture가 준비되지 않았습니다.");
    }
    return cursor;
  }
  encodeReplies(..._args: Parameters<TodoCommentCursorCodecPort["encodeReplies"]>) {
    const cursor = this.encodedReplies.shift();
    if (cursor === undefined) {
      throw new Error("답글 cursor 응답 fixture가 준비되지 않았습니다.");
    }
    return cursor;
  }
}

export function createEngagementCommentReader() {
  return new StubEngagementCommentReader(new StubEngagementCommentRepository());
}

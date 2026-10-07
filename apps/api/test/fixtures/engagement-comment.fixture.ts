import type {
  TodoCommentRecord,
  TodoConversationRecord,
  TodoConversationCursor,
  TodoCommentOverviewCursor,
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
    parentId: null,
    rootId: null,
    path: [],
    depth: 0,
    parentAuthorName: null,
    authorId: ENGAGEMENT_OWNER_ID,
    authorName: "작성자",
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
    continuingAncestorDepths: [],
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
      rootId: null,
      path: [],
      content: "댓글 원문",
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
  decodedOverview: TodoCommentOverviewCursor | undefined;
  encodedConversations = ["previous", "next"];
  encodedOverviews = ["previous", "next"];
  decodeConversation() {
    if (this.decodedConversation === undefined)
      throw new Error("대화 cursor fixture가 준비되지 않았습니다.");
    return structuredClone(this.decodedConversation);
  }
  decodeOverview() {
    if (this.decodedOverview === undefined)
      throw new Error("개요 cursor fixture가 준비되지 않았습니다.");
    return structuredClone(this.decodedOverview);
  }
  encodeConversation() {
    const cursor = this.encodedConversations.shift();
    if (cursor === undefined) throw new Error("대화 cursor 응답 fixture가 준비되지 않았습니다.");
    return cursor;
  }
  encodeOverview() {
    const cursor = this.encodedOverviews.shift();
    if (cursor === undefined) throw new Error("개요 cursor 응답 fixture가 준비되지 않았습니다.");
    return cursor;
  }
}

export function createEngagementCommentReader() {
  return new StubEngagementCommentReader(new StubEngagementCommentRepository());
}

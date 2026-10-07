import { vi } from "vitest";

import type { TodoCommentCursorCodecPort } from "#api/modules/engagement/application/ports/comments/todo-comment-cursor-codec.port";
import type { TodoCommentNotificationPort } from "#api/modules/engagement/application/ports/comments/todo-comment-notification.port";
import type { TodoCommentReaderPort } from "#api/modules/engagement/application/ports/comments/todo-comment.reader.port";
import type { TodoCommentRepositoryPort } from "#api/modules/engagement/application/ports/comments/todo-comment.repository.port";
import type { TodoViewCachePort } from "#api/modules/engagement/application/ports/comments/todo-view-cache.port";
import type { MutationLockPort } from "#api/shared/application/ports/index";

/**
 * todo-comment 포트 mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `vi.mocked(mock.method)`로 접근합니다.
 */
export function createTodoCommentRepositoryMock(): TodoCommentRepositoryPort {
  return {
    findComment: vi.fn(),
    findCommentChainReplay: vi.fn(),
    createCommentChain: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    increaseTodoCommentCount: vi.fn(),
    decrementTodoCommentCount: vi.fn(),
    incrementReplyCount: vi.fn(),
    dropDeletedFromAncestors: vi.fn(),
    setLike: vi.fn(),
    markLikeNotified: vi.fn(),
    removeLike: vi.fn(),
    recordView: vi.fn(),
  };
}

export function createTodoCommentReaderMock(): TodoCommentReaderPort {
  return {
    findAccessibleTodoDetails: vi.fn(),
    canAccessTodo: vi.fn(),
    findCommentRecord: vi.fn(),
    findCommentRecords: vi.fn(),
    listOverview: vi.fn(),
    listConversation: vi.fn(),
    findAncestors: vi.fn(),
    findLikedCommentIds: vi.fn(),
    findUserDisplayName: vi.fn(),
  };
}

export function createTodoCommentCursorCodecMock(): TodoCommentCursorCodecPort {
  return {
    decodeConversation: vi.fn(),
    encodeConversation: vi.fn(),
    decodeOverview: vi.fn(),
    encodeOverview: vi.fn(),
  };
}

export function createMutationLockMock(): MutationLockPort {
  return { acquire: vi.fn() };
}

export function createTodoCommentNotificationMock(): TodoCommentNotificationPort {
  return {
    notifyCommentsWritten: vi.fn(),
    notifyCommentLiked: vi.fn(),
  };
}

export function createTodoViewCacheMock(): TodoViewCachePort {
  return {
    invalidateForTodo: vi.fn(),
  };
}

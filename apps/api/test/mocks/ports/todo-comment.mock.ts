import type { MutationLockPort } from "@/shared/application/ports";
import type { TodoCommentCursorCodecPort } from "@/todo-comment/application/ports/todo-comment-cursor-codec.port";
import type { TodoCommentNotificationPort } from "@/todo-comment/application/ports/todo-comment-notification.port";
import type { TodoCommentReaderPort } from "@/todo-comment/application/ports/todo-comment.reader.port";
import type { TodoCommentRepositoryPort } from "@/todo-comment/application/ports/todo-comment.repository.port";
import type { TodoViewCachePort } from "@/todo-comment/application/ports/todo-view-cache.port";

/**
 * todo-comment 포트 mock 팩토리.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는
 * `jest.mocked(mock.method)`로 접근합니다.
 */
export function createTodoCommentRepositoryMock(): TodoCommentRepositoryPort {
	return {
		findComment: jest.fn(),
		findCommentChainReplay: jest.fn(),
		createCommentChain: jest.fn(),
		updateComment: jest.fn(),
		deleteComment: jest.fn(),
		increaseTodoCommentCount: jest.fn(),
		decrementTodoCommentCount: jest.fn(),
		incrementReplyCount: jest.fn(),
		dropDeletedFromAncestors: jest.fn(),
		setLike: jest.fn(),
		markLikeNotified: jest.fn(),
		removeLike: jest.fn(),
		recordView: jest.fn(),
	};
}

export function createTodoCommentReaderMock(): TodoCommentReaderPort {
	return {
		findAccessibleTodoDetails: jest.fn(),
		canAccessTodo: jest.fn(),
		findCommentRecord: jest.fn(),
		findCommentRecords: jest.fn(),
		listOverview: jest.fn(),
		listConversation: jest.fn(),
		findAncestors: jest.fn(),
		findLikedCommentIds: jest.fn(),
		findUserDisplayName: jest.fn(),
	};
}

export function createTodoCommentCursorCodecMock(): TodoCommentCursorCodecPort {
	return {
		decodeConversation: jest.fn(),
		encodeConversation: jest.fn(),
		decodeOverview: jest.fn(),
		encodeOverview: jest.fn(),
	};
}

export function createMutationLockMock(): MutationLockPort {
	return { acquire: jest.fn() };
}

export function createTodoCommentNotificationMock(): TodoCommentNotificationPort {
	return {
		notifyCommentsWritten: jest.fn(),
		notifyCommentLiked: jest.fn(),
	};
}

export function createTodoViewCacheMock(): TodoViewCachePort {
	return {
		invalidateForTodo: jest.fn(),
	};
}

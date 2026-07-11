import type { CategoryOwnershipPort } from "@/todo/application/ports/category-ownership.port";
import type { FriendPort } from "@/todo/application/ports/friend.port";
import type { StreakPort } from "@/todo/application/ports/streak.port";
import type { TodoCachePort } from "@/todo/application/ports/todo-cache.port";
import type { TodoNotificationPort } from "@/todo/application/ports/todo-notification.port";

/**
 * 크로스모듈 포트 mock 팩토리 모음
 *
 * 각 팩토리는 포트 인터페이스를 반환합니다. 메서드 mock API는 `jest.mocked(mock.method)`로 접근합니다.
 */

export function createCategoryOwnershipMock(): CategoryOwnershipPort {
	return {
		validateOwnership: jest.fn(),
	};
}

export function createTodoCacheMock(): TodoCachePort {
	return {
		invalidateTodoCategories: jest.fn(),
		getFriendTodosFirstPage: jest.fn(),
		setFriendTodosFirstPage: jest.fn(),
		invalidateFriendTodos: jest.fn(),
	};
}

export function createFriendMock(): FriendPort {
	return {
		isMutualFriend: jest.fn(),
		getMutualFriendIds: jest.fn(),
		getUserDisplayName: jest.fn(),
	};
}

export function createStreakMock(): StreakPort {
	return {
		recordTodoToggle: jest.fn(),
	};
}

export function createTodoNotificationMock(): TodoNotificationPort {
	return {
		enqueueFriendCompleted: jest.fn(),
		enqueueMilestoneReached: jest.fn(),
	};
}

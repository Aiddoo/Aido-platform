import { vi } from "vitest";

import type { CategoryOwnershipPort } from "#api/modules/planning/application/ports/todos/category-ownership.port";
import type { FriendPort } from "#api/modules/planning/application/ports/todos/friend.port";
import type { StreakPort } from "#api/modules/planning/application/ports/todos/streak.port";
import type { TodoCachePort } from "#api/modules/planning/application/ports/todos/todo-cache.port";
import type { TodoNotificationPort } from "#api/modules/planning/application/ports/todos/todo-notification.port";

/**
 * 크로스모듈 포트 mock 팩토리 모음
 *
 * 각 팩토리는 포트 인터페이스를 반환합니다. 메서드 mock API는 `vi.mocked(mock.method)`로 접근합니다.
 */

export function createCategoryOwnershipMock(): CategoryOwnershipPort {
  return {
    validateOwnership: vi.fn(),
  };
}

export function createTodoCacheMock(): TodoCachePort {
  return {
    invalidateTodoCategories: vi.fn(),
    readFriendTodosFirstPage: vi
      .fn()
      .mockResolvedValue({ generation: "test-generation", page: undefined }),
    storeFriendTodosFirstPageIfCurrent: vi.fn(),
    invalidateFriendTodos: vi.fn(),
  };
}

export function createFriendMock(): FriendPort {
  return {
    isMutualFriend: vi.fn(),
    getMutualFriendIds: vi.fn(),
    getUserDisplayName: vi.fn(),
  };
}

export function createStreakMock(): StreakPort {
  return {
    recordTodoToggle: vi.fn(),
    getStreakContext: vi.fn(),
  };
}

export function createTodoNotificationMock(): TodoNotificationPort {
  return {
    enqueueFriendCompleted: vi.fn(),
    enqueueMilestoneReached: vi.fn(),
  };
}

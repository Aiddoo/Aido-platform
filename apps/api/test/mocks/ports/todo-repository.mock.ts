import { vi } from "vitest";

import type { TodoRepositoryPort } from "#api/todo/application/ports/todo.repository.port";

/**
 * TODO_REPOSITORY(쓰기) 포트 mock 팩토리
 *
 * @suites/unit이 Symbol 토큰 포트를 auto-mock하지 못하므로 모든 메서드를 명시합니다.
 * 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드의 mock API가 필요하면 spec에서 `vi.mocked(mock.method)`로 접근합니다.
 */
export function createTodoRepositoryMock(): TodoRepositoryPort {
  return {
    findByIdAndUserId: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    createInlineItems: vi.fn(),
    updateCompletion: vi.fn(),
    updateDetails: vi.fn(),
    updateTitle: vi.fn(),
    updateVisibility: vi.fn(),
    updateSchedule: vi.fn(),
    updateCategory: vi.fn(),
    delete: vi.fn(),
    updateSortOrder: vi.fn(),
    shiftSortOrders: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    reorderItems: vi.fn(),
    countActiveByCategory: vi.fn(),
    getMaxSortOrder: vi.fn(),
  };
}

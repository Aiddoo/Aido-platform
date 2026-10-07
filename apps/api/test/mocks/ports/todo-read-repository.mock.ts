import { vi } from "vitest";

import type { TodoReadRepositoryPort } from "#api/modules/planning/application/ports/todos/todo-read.repository.port";

/**
 * TODO_READ_REPOSITORY(읽기) 포트 mock 팩토리
 *
 * 응답 read model을 반환하는 조회 포트. 개별 메서드 mock API는 `vi.mocked(mock.method)`로 접근합니다.
 */
export function createTodoReadRepositoryMock(): TodoReadRepositoryPort {
  return {
    findByIdAndUserId: vi.fn(),
    findOwnerId: vi.fn(),
    findManyByRecurrenceGroupId: vi.fn(),
    findManyByUserId: vi.fn(),
    findPublicTodosByUserId: vi.fn(),
    countActiveByCategory: vi.fn(),
    countCompletedByUser: vi.fn(),
    getTodayTodoStats: vi.fn(),
    findTodayTopTodos: vi.fn(),
  };
}

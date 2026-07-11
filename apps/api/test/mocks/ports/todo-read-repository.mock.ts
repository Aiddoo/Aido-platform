import type { TodoReadRepositoryPort } from "@/todo/application/ports/todo-read.repository.port";

/**
 * TODO_READ_REPOSITORY(읽기) 포트 mock 팩토리
 *
 * 응답 read model을 반환하는 조회 포트. 개별 메서드 mock API는 `jest.mocked(mock.method)`로 접근합니다.
 */
export function createTodoReadRepositoryMock(): TodoReadRepositoryPort {
	return {
		findByIdAndUserId: jest.fn(),
		findManyByRecurrenceGroupId: jest.fn(),
		findManyByUserId: jest.fn(),
		findPublicTodosByUserId: jest.fn(),
		countActiveByCategory: jest.fn(),
		countCompletedByUser: jest.fn(),
		getTodayTodoStats: jest.fn(),
	};
}

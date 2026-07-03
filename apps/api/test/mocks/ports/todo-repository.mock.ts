import type { TodoRepositoryPort } from "@/modules/todo/application/ports/todo.repository.port";

/**
 * TODO_REPOSITORY(쓰기) 포트 mock 팩토리
 *
 * @suites/unit이 Symbol 토큰 포트를 auto-mock하지 못하므로 모든 메서드를 명시합니다.
 * 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드의 mock API가 필요하면 spec에서 `jest.mocked(mock.method)`로 접근합니다.
 */
export function createTodoRepositoryMock(): TodoRepositoryPort {
	return {
		findByIdAndUserId: jest.fn(),
		create: jest.fn(),
		createInlineItems: jest.fn(),
		updateCompletion: jest.fn(),
		updateDetails: jest.fn(),
		updateTitle: jest.fn(),
		updateVisibility: jest.fn(),
		updateSchedule: jest.fn(),
		updateCategory: jest.fn(),
		delete: jest.fn(),
		updateSortOrder: jest.fn(),
		shiftSortOrders: jest.fn(),
		countItemsByTodoId: jest.fn(),
		getMaxItemSortOrder: jest.fn(),
		createItem: jest.fn(),
		updateItem: jest.fn(),
		deleteItem: jest.fn(),
		reorderItems: jest.fn(),
		countActiveByCategory: jest.fn(),
		getMaxSortOrder: jest.fn(),
	};
}

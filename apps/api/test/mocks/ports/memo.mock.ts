import type { MemoRepositoryPort } from "@/memo/application/ports/memo.repository.port";
import type { TodoCreatorPort } from "@/memo/application/ports/todo-creator.port";

/**
 * MEMO_REPOSITORY 포트 mock 팩토리
 *
 * @suites/unit이 Symbol 토큰 포트를 auto-mock하지 못하므로 모든 메서드를 명시합니다.
 * 반환 타입을 포트 인터페이스로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드의 mock API가 필요하면 spec에서 `jest.mocked(mock.method)`로 접근합니다.
 */
export function createMemoRepositoryMock(): MemoRepositoryPort {
	return {
		create: jest.fn(),
		findByIdAndUserId: jest.fn(),
		findManyByUserId: jest.fn(),
		countByUserId: jest.fn(),
		updateContent: jest.fn(),
		updatePinned: jest.fn(),
		updateSortOrder: jest.fn(),
		getMaxSortOrder: jest.fn(),
		shiftSortOrders: jest.fn(),
		delete: jest.fn(),
	};
}

/**
 * TODO_CREATOR 포트(ACL) mock 팩토리
 *
 * 메모가 todo 생성에 의존하는 유일한 통로입니다. 단건/반복 생성 두 메서드를
 * 명시하며, 포트 확장 시 누락을 타입 에러로 잡습니다.
 */
export function createTodoCreatorMock(): TodoCreatorPort {
	return {
		createTodo: jest.fn(),
		createRecurringTodos: jest.fn(),
	};
}

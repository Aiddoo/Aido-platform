import type { Mocked } from "@suites/doubles.jest";
import type { TodoRepositoryPort } from "@/modules/todo/application/ports/todo.repository.port";

/**
 * TODO_REPOSITORY 포트 mock 팩토리
 *
 * @suites/unit이 Symbol 토큰 포트를 auto-mock하지 못하므로 모든 메서드를 명시합니다.
 * 반환 타입을 Mocked<TodoRepositoryPort>로 강제해 포트 확장 시 누락을 타입 에러로 잡습니다.
 */
export function createTodoRepositoryMock(): Mocked<TodoRepositoryPort> {
	return {
		findByIdAndUserId: jest.fn(),
		findManyByUserId: jest.fn(),
		findPublicTodosByUserId: jest.fn(),
		create: jest.fn(),
		createInlineItems: jest.fn(),
		update: jest.fn(),
		countActiveByCategory: jest.fn(),
		getMaxSortOrder: jest.fn(),
		countCompletedByUser: jest.fn(),
		getTodayTodoStats: jest.fn(),
	} as unknown as Mocked<TodoRepositoryPort>;
}

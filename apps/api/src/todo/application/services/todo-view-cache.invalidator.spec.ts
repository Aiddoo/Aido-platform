/**
 * TodoViewCacheInvalidator 단위 테스트
 *
 * 다른 모듈이 보는 유일한 표면이라, 소유자 해석과 무효화 위임만 검증한다.
 */

import { createTodoCacheMock, createTodoReadRepositoryMock } from "@test/mocks/ports";

import { TodoViewCacheInvalidator } from "./todo-view-cache.invalidator";

describe("TodoViewCacheInvalidator", () => {
	it("할 일의 소유자를 찾아 그 사람의 친구 목록 캐시를 버린다", async () => {
		// Given - 캐시 키는 소유자 기준이므로 todoId만으로는 지울 수 없다
		const readRepository = createTodoReadRepositoryMock();
		const cache = createTodoCacheMock();
		jest.mocked(readRepository.findOwnerId).mockResolvedValue("owner-1");
		const invalidator = new TodoViewCacheInvalidator(readRepository, cache);

		// When
		await invalidator.invalidateForTodo(42);

		// Then
		expect(readRepository.findOwnerId).toHaveBeenCalledWith(42);
		expect(cache.invalidateFriendTodos).toHaveBeenCalledWith("owner-1");
	});

	it("할 일이 사라졌으면 지울 캐시도 없다", async () => {
		// Given
		const readRepository = createTodoReadRepositoryMock();
		const cache = createTodoCacheMock();
		jest.mocked(readRepository.findOwnerId).mockResolvedValue(null);
		const invalidator = new TodoViewCacheInvalidator(readRepository, cache);

		// When
		await invalidator.invalidateForTodo(42);

		// Then
		expect(cache.invalidateFriendTodos).not.toHaveBeenCalled();
	});
});

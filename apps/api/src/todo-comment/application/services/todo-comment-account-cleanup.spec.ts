import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { MUTATION_LOCK, type MutationLockPort } from "@/shared/application/ports";

import {
	TODO_COMMENT_ACCOUNT_CLEANUP_STORE,
	type TodoCommentAccountCleanupStorePort,
} from "../ports/todo-comment-account-cleanup.store.port";
import { TODO_VIEW_CACHE, type TodoViewCachePort } from "../ports/todo-view-cache.port";
import { TodoCommentAccountCleanup } from "./todo-comment-account-cleanup";

function createCleanupStoreMock(): TodoCommentAccountCleanupStorePort {
	return {
		plan: jest.fn(),
		cleanup: jest.fn(),
	};
}

function createTodoViewCacheMock(): TodoViewCachePort {
	return { invalidateForTodo: jest.fn() };
}

function createMutationLockMock(): MutationLockPort {
	return { acquire: jest.fn() };
}

describe("TodoCommentAccountCleanup", () => {
	let cleanup: TodoCommentAccountCleanup;
	let store: Mocked<TodoCommentAccountCleanupStorePort>;
	let todoViewCache: Mocked<TodoViewCachePort>;
	let mutationLock: Mocked<MutationLockPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(TodoCommentAccountCleanup)
			.mock(TODO_COMMENT_ACCOUNT_CLEANUP_STORE)
			.impl(createCleanupStoreMock)
			.mock(TODO_VIEW_CACHE)
			.impl(createTodoViewCacheMock)
			.mock(MUTATION_LOCK)
			.impl(createMutationLockMock)
			.compile();

		cleanup = unit;
		store = unitRef.get(TODO_COMMENT_ACCOUNT_CLEANUP_STORE);
		todoViewCache = unitRef.get(TODO_VIEW_CACHE);
		mutationLock = unitRef.get(MUTATION_LOCK);
	});

	it("정리 대상 댓글을 잠근 뒤 같은 UoW에서 묘비와 counter를 정산한다", async () => {
		// Given
		store.plan.mockResolvedValue({
			affectedTodoIds: [8, 13],
			commentIdsToLock: ["comment-1", "comment-2"],
		});

		// When
		const result = await cleanup.cleanupInTransaction("user-1");

		// Then
		expect(mutationLock.acquire).toHaveBeenCalledWith([
			"mutation:v1:todo-comment:comment-1",
			"mutation:v1:todo-comment:comment-2",
		]);
		expect(store.cleanup).toHaveBeenCalledWith("user-1", {
			affectedTodoIds: [8, 13],
			commentIdsToLock: ["comment-1", "comment-2"],
		});
		expect(mutationLock.acquire.mock.invocationCallOrder[0]).toBeLessThan(
			store.cleanup.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
		);
		expect(result).toEqual({ affectedTodoIds: [8, 13] });
	});

	it("정리 대상 댓글이 없어도 store가 사용자 참조를 최종 확인한다", async () => {
		// Given
		store.plan.mockResolvedValue({ affectedTodoIds: [], commentIdsToLock: [] });

		// When
		await cleanup.cleanupInTransaction("user-1");

		// Then
		expect(mutationLock.acquire).not.toHaveBeenCalled();
		expect(store.cleanup).toHaveBeenCalledWith("user-1", {
			affectedTodoIds: [],
			commentIdsToLock: [],
		});
	});

	it("커밋 뒤 todo cache 정리가 실패해도 완료된 계정 삭제를 실패로 바꾸지 않는다", async () => {
		// Given
		todoViewCache.invalidateForTodo.mockRejectedValueOnce(new Error("cache unavailable"));

		// When / Then
		await expect(cleanup.settleAfterCommit({ affectedTodoIds: [8, 13] })).resolves.toBeUndefined();
		expect(todoViewCache.invalidateForTodo).toHaveBeenCalledTimes(2);
		expect(todoViewCache.invalidateForTodo).toHaveBeenNthCalledWith(1, 8);
		expect(todoViewCache.invalidateForTodo).toHaveBeenNthCalledWith(2, 13);
	});
});

import { TodoCategoryMapper } from "./todo-category.mapper";
import type {
	TodoCategoryEntity,
	TodoCategoryWithCountEntity,
} from "./types/todo-category.types";

describe("TodoCategoryMapper", () => {
	const createMockCategory = (
		overrides: Partial<TodoCategoryEntity> = {},
	): TodoCategoryEntity => ({
		id: 1,
		userId: "user-123",
		name: "중요한 일",
		color: "#FFB3B3",
		sortOrder: 0,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
		...overrides,
	});

	const createMockCategoryWithCount = (
		overrides: Partial<TodoCategoryWithCountEntity> = {},
	): TodoCategoryWithCountEntity => ({
		id: 1,
		userId: "user-123",
		name: "중요한 일",
		color: "#FFB3B3",
		sortOrder: 0,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
		_count: { todos: 5 },
		...overrides,
	});

	describe("toResponse", () => {
		it("TodoCategory 엔티티를 올바른 응답 형식으로 변환해야 한다", () => {
			const category = createMockCategory();
			const result = TodoCategoryMapper.toResponse(category);

			expect(result).toEqual({
				id: 1,
				userId: "user-123",
				name: "중요한 일",
				color: "#FFB3B3",
				sortOrder: 0,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
			});
		});

		it("다양한 색상 코드를 올바르게 처리해야 한다", () => {
			const category = createMockCategory({ color: "#FF6B43" });
			const result = TodoCategoryMapper.toResponse(category);

			expect(result.color).toBe("#FF6B43");
		});

		it("다른 sortOrder 값을 올바르게 처리해야 한다", () => {
			const category = createMockCategory({ sortOrder: 5 });
			const result = TodoCategoryMapper.toResponse(category);

			expect(result.sortOrder).toBe(5);
		});
	});

	describe("toSummary", () => {
		it("TodoCategory 엔티티를 요약 형식으로 변환해야 한다", () => {
			const category = createMockCategory();
			const result = TodoCategoryMapper.toSummary(category);

			expect(result).toEqual({
				id: 1,
				name: "중요한 일",
				color: "#FFB3B3",
			});
		});

		it("userId, sortOrder, timestamps는 포함하지 않아야 한다", () => {
			const category = createMockCategory();
			const result = TodoCategoryMapper.toSummary(category);

			expect(result).not.toHaveProperty("userId");
			expect(result).not.toHaveProperty("sortOrder");
			expect(result).not.toHaveProperty("createdAt");
			expect(result).not.toHaveProperty("updatedAt");
		});
	});

	describe("toResponseWithCount", () => {
		it("Todo 개수가 포함된 응답 형식으로 변환해야 한다", () => {
			const category = createMockCategoryWithCount();
			const result = TodoCategoryMapper.toResponseWithCount(category);

			expect(result).toEqual({
				id: 1,
				userId: "user-123",
				name: "중요한 일",
				color: "#FFB3B3",
				sortOrder: 0,
				todoCount: 5,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
			});
		});

		it("Todo 개수가 0인 경우를 올바르게 처리해야 한다", () => {
			const category = createMockCategoryWithCount({
				_count: { todos: 0 },
			});
			const result = TodoCategoryMapper.toResponseWithCount(category);

			expect(result.todoCount).toBe(0);
		});

		it("다양한 Todo 개수를 올바르게 처리해야 한다", () => {
			const category = createMockCategoryWithCount({
				_count: { todos: 100 },
			});
			const result = TodoCategoryMapper.toResponseWithCount(category);

			expect(result.todoCount).toBe(100);
		});
	});

	describe("toManyResponse", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			const result = TodoCategoryMapper.toManyResponse([]);
			expect(result).toEqual([]);
		});

		it("여러 카테고리를 올바르게 변환해야 한다", () => {
			const categories = [
				createMockCategory({ id: 1, name: "중요한 일", sortOrder: 0 }),
				createMockCategory({ id: 2, name: "할 일", sortOrder: 1 }),
				createMockCategory({ id: 3, name: "공부", sortOrder: 2 }),
			];
			const result = TodoCategoryMapper.toManyResponse(categories);

			expect(result).toHaveLength(3);
			expect(result[0]?.id).toBe(1);
			expect(result[0]?.name).toBe("중요한 일");
			expect(result[1]?.id).toBe(2);
			expect(result[1]?.name).toBe("할 일");
			expect(result[2]?.id).toBe(3);
			expect(result[2]?.name).toBe("공부");
		});
	});

	describe("toManyResponseWithCount", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			const result = TodoCategoryMapper.toManyResponseWithCount([]);
			expect(result).toEqual([]);
		});

		it("여러 카테고리를 Todo 개수와 함께 변환해야 한다", () => {
			const categories = [
				createMockCategoryWithCount({
					id: 1,
					name: "중요한 일",
					_count: { todos: 3 },
				}),
				createMockCategoryWithCount({
					id: 2,
					name: "할 일",
					_count: { todos: 10 },
				}),
			];
			const result = TodoCategoryMapper.toManyResponseWithCount(categories);

			expect(result).toHaveLength(2);
			expect(result[0]?.todoCount).toBe(3);
			expect(result[1]?.todoCount).toBe(10);
		});
	});
});

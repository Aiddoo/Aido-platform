/**
 * TodoCategoryMapper 매퍼 단위 테스트
 *
 * @description
 * TodoCategoryMapper의 변환 로직을 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo-category.mapper
 * ```
 */
import { TodoCategoryBuilder } from "@test/builders";
import { TodoCategoryMapper } from "./todo-category.mapper";

describe("TodoCategoryMapper — 할 일 카테고리 매퍼", () => {
	beforeEach(() => {
		TodoCategoryBuilder.resetIdCounter();
	});

	describe("toResponse", () => {
		it("TodoCategory 엔티티를 올바른 응답 형식으로 변환해야 한다", () => {
			// Given - 변환할 TodoCategory 엔티티 준비
			const category = TodoCategoryBuilder.create("user-123")
				.withId(1)
				.withName("중요한 일")
				.withColor("#FFB3B3")
				.withSortOrder(0)
				.withCreatedAt(new Date("2026-01-01T00:00:00.000Z"))
				.withUpdatedAt(new Date("2026-01-02T00:00:00.000Z"))
				.build();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toResponse(category);

			// Then - 올바른 응답 형식으로 변환되었는지 검증
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
			// Given - 특정 색상이 설정된 카테고리 준비
			const category = TodoCategoryBuilder.create("user-123")
				.withColor("#FF6B43")
				.build();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toResponse(category);

			// Then - 색상 코드가 올바르게 변환되었는지 검증
			expect(result.color).toBe("#FF6B43");
		});

		it("다른 sortOrder 값을 올바르게 처리해야 한다", () => {
			// Given - 특정 sortOrder가 설정된 카테고리 준비
			const category = TodoCategoryBuilder.create("user-123")
				.withSortOrder(5)
				.build();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toResponse(category);

			// Then - sortOrder가 올바르게 변환되었는지 검증
			expect(result.sortOrder).toBe(5);
		});
	});

	describe("toSummary", () => {
		it("TodoCategory 엔티티를 요약 형식으로 변환해야 한다", () => {
			// Given - 요약 형식으로 변환할 카테고리 준비
			const category = TodoCategoryBuilder.create("user-123")
				.withId(1)
				.withName("중요한 일")
				.withColor("#FFB3B3")
				.build();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toSummary(category);

			// Then - 요약 형식으로 변환되었는지 검증
			expect(result).toEqual({
				id: 1,
				name: "중요한 일",
				color: "#FFB3B3",
				sortOrder: 0,
			});
		});

		it("userId, timestamps는 포함하지 않아야 한다", () => {
			// Given - 변환할 카테고리 준비
			const category = TodoCategoryBuilder.create("user-123").build();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toSummary(category);

			// Then - 불필요한 필드가 제외되었는지 검증
			expect(result).not.toHaveProperty("userId");
			expect(result).not.toHaveProperty("createdAt");
			expect(result).not.toHaveProperty("updatedAt");
		});
	});

	describe("toResponseWithCount", () => {
		it("Todo 개수가 포함된 응답 형식으로 변환해야 한다", () => {
			// Given - Todo 개수가 포함된 카테고리 준비
			const category = TodoCategoryBuilder.create("user-123")
				.withId(1)
				.withName("중요한 일")
				.withColor("#FFB3B3")
				.withSortOrder(0)
				.withCreatedAt(new Date("2026-01-01T00:00:00.000Z"))
				.withUpdatedAt(new Date("2026-01-02T00:00:00.000Z"))
				.withTodoCount(5)
				.buildWithCount();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toResponseWithCount(category);

			// Then - Todo 개수가 포함된 응답 형식으로 변환되었는지 검증
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
			// Given - Todo 개수가 0인 카테고리 준비
			const category = TodoCategoryBuilder.create("user-123")
				.withTodoCount(0)
				.buildWithCount();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toResponseWithCount(category);

			// Then - todoCount가 0인지 검증
			expect(result.todoCount).toBe(0);
		});

		it("다양한 Todo 개수를 올바르게 처리해야 한다", () => {
			// Given - 많은 Todo 개수가 포함된 카테고리 준비
			const category = TodoCategoryBuilder.create("user-123")
				.withTodoCount(100)
				.buildWithCount();

			// When - Mapper 호출
			const result = TodoCategoryMapper.toResponseWithCount(category);

			// Then - todoCount가 올바르게 변환되었는지 검증
			expect(result.todoCount).toBe(100);
		});
	});

	describe("toManyResponse", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			// Given - 빈 배열 준비

			// When - Mapper 호출
			const result = TodoCategoryMapper.toManyResponse([]);

			// Then - 빈 배열이 반환되는지 검증
			expect(result).toEqual([]);
		});

		it("여러 카테고리를 올바르게 변환해야 한다", () => {
			// Given - 여러 카테고리 배열 준비
			const categories = [
				TodoCategoryBuilder.create("user-123")
					.withId(1)
					.withName("중요한 일")
					.withSortOrder(0)
					.build(),
				TodoCategoryBuilder.create("user-123")
					.withId(2)
					.withName("할 일")
					.withSortOrder(1)
					.build(),
				TodoCategoryBuilder.create("user-123")
					.withId(3)
					.withName("공부")
					.withSortOrder(2)
					.build(),
			];

			// When - Mapper 호출
			const result = TodoCategoryMapper.toManyResponse(categories);

			// Then - 여러 카테고리가 올바르게 변환되었는지 검증
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
			// Given - 빈 배열 준비

			// When - Mapper 호출
			const result = TodoCategoryMapper.toManyResponseWithCount([]);

			// Then - 빈 배열이 반환되는지 검증
			expect(result).toEqual([]);
		});

		it("여러 카테고리를 Todo 개수와 함께 변환해야 한다", () => {
			// Given - Todo 개수가 포함된 여러 카테고리 배열 준비
			const categories = [
				TodoCategoryBuilder.create("user-123")
					.withId(1)
					.withName("중요한 일")
					.withTodoCount(3)
					.buildWithCount(),
				TodoCategoryBuilder.create("user-123")
					.withId(2)
					.withName("할 일")
					.withTodoCount(10)
					.buildWithCount(),
			];

			// When - Mapper 호출
			const result = TodoCategoryMapper.toManyResponseWithCount(categories);

			// Then - 여러 카테고리가 Todo 개수와 함께 올바르게 변환되었는지 검증
			expect(result).toHaveLength(2);
			expect(result[0]?.todoCount).toBe(3);
			expect(result[1]?.todoCount).toBe(10);
		});
	});
});

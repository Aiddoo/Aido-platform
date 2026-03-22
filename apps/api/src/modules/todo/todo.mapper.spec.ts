import { TodoBuilder } from "@test/builders";
import type { TodoItemData } from "@/modules/todo/types/todo.types";
import { TodoMapper } from "./todo.mapper";

describe("TodoMapper", () => {
	beforeEach(() => {
		TodoBuilder.resetIdCounter();
	});

	describe("formatDate", () => {
		it("Date 객체를 YYYY-MM-DD 형식의 문자열로 변환해야 한다", () => {
			// Given - 변환할 Date 객체 준비
			const date = new Date("2024-01-15T10:30:00.000Z");

			// When - formatDate 호출
			const result = TodoMapper.formatDate(date);

			// Then - YYYY-MM-DD 형식으로 변환되었는지 검증
			expect(result).toBe("2024-01-15");
		});

		it("월과 일이 한 자리수일 때 0을 패딩해야 한다", () => {
			// Given - 한 자리수 월/일이 포함된 Date 객체 준비
			const date = new Date("2024-03-05T00:00:00.000Z");

			// When - formatDate 호출
			const result = TodoMapper.formatDate(date);

			// Then - 0 패딩이 적용되었는지 검증
			expect(result).toBe("2024-03-05");
		});
	});

	describe("toResponse", () => {
		it("Todo 엔티티를 올바른 응답 형식으로 변환해야 한다", () => {
			// Given - 변환할 Todo 엔티티 준비
			const todo = TodoBuilder.create("user-123")
				.withId(1)
				.withTitle("테스트 할 일")
				.withContent("테스트 내용")
				.withSortOrder(0)
				.uncompleted()
				.withStartDate(new Date("2024-01-15T00:00:00.000Z"))
				.withEndDate(new Date("2024-01-16T00:00:00.000Z"))
				.withScheduledTime(new Date("2024-01-15T10:00:00.000Z"))
				.withIsAllDay(false)
				.withVisibility("PUBLIC")
				.withCategory({
					id: 1,
					name: "중요한 일",
					color: "#FFB3B3",
					sortOrder: 0,
				})
				.withCreatedAt(new Date("2024-01-01T00:00:00.000Z"))
				.withUpdatedAt(new Date("2024-01-02T00:00:00.000Z"))
				.build();

			// When - Mapper 호출
			const result = TodoMapper.toResponse(todo);

			// Then - 올바른 응답 형식으로 변환되었는지 검증
			expect(result).toEqual({
				id: 1,
				userId: "user-123",
				title: "테스트 할 일",
				content: "테스트 내용",
				sortOrder: 0,
				completed: false,
				completedAt: null,
				startDate: "2024-01-15",
				endDate: "2024-01-16",
				scheduledTime: "2024-01-15T10:00:00.000Z",
				isAllDay: false,
				visibility: "PUBLIC",
				recurrenceGroupId: null,
				category: {
					id: 1,
					name: "중요한 일",
					color: "#FFB3B3",
					sortOrder: 0,
				},
				items: [],
				itemStats: { total: 0, completed: 0 },
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			});
		});

		it("완료된 Todo를 올바르게 변환해야 한다", () => {
			// Given - 완료된 Todo 엔티티 준비
			const completedAt = new Date("2024-01-15T15:00:00.000Z");
			const todo = TodoBuilder.create("user-123")
				.completed(completedAt)
				.build();

			// When - Mapper 호출
			const result = TodoMapper.toResponse(todo);

			// Then - 완료 상태가 올바르게 변환되었는지 검증
			expect(result.completed).toBe(true);
			expect(result.completedAt).toBe("2024-01-15T15:00:00.000Z");
		});

		it("null 값들을 올바르게 처리해야 한다", () => {
			// Given - null 값이 포함된 Todo 엔티티 준비
			const todo = TodoBuilder.create("user-123")
				.withContent(null)
				.withEndDate(null)
				.withScheduledTime(null)
				.build();

			// When - Mapper 호출
			const result = TodoMapper.toResponse(todo);

			// Then - null 값이 올바르게 유지되는지 검증
			expect(result.content).toBeNull();
			expect(result.endDate).toBeNull();
			expect(result.scheduledTime).toBeNull();
		});

		it("PRIVATE visibility를 올바르게 처리해야 한다", () => {
			// Given - PRIVATE 공개 범위의 Todo 엔티티 준비
			const todo = TodoBuilder.create("user-123").asPrivate().build();

			// When - Mapper 호출
			const result = TodoMapper.toResponse(todo);

			// Then - PRIVATE visibility가 올바르게 변환되었는지 검증
			expect(result.visibility).toBe("PRIVATE");
		});

		it("하루 종일 Todo를 올바르게 변환해야 한다", () => {
			// Given - 하루 종일 Todo 엔티티 준비
			const todo = TodoBuilder.create("user-123")
				.withIsAllDay(true)
				.withScheduledTime(null)
				.build();

			// When - Mapper 호출
			const result = TodoMapper.toResponse(todo);

			// Then - 하루 종일 플래그가 올바르게 변환되었는지 검증
			expect(result.isAllDay).toBe(true);
			expect(result.scheduledTime).toBeNull();
		});

		it("카테고리 정보를 올바르게 변환해야 한다", () => {
			// Given - 특정 카테고리가 포함된 Todo 엔티티 준비
			const todo = TodoBuilder.create("user-123")
				.withCategory({ id: 2, name: "할 일", color: "#FF6B43", sortOrder: 1 })
				.build();

			// When - Mapper 호출
			const result = TodoMapper.toResponse(todo);

			// Then - 카테고리 정보가 올바르게 변환되었는지 검증
			expect(result.category).toEqual({
				id: 2,
				name: "할 일",
				color: "#FF6B43",
				sortOrder: 1,
			});
		});

		it("sortOrder를 올바르게 변환해야 한다", () => {
			// Given - 특정 sortOrder가 설정된 Todo 엔티티 준비
			const todo = TodoBuilder.create("user-123").withSortOrder(5).build();

			// When - Mapper 호출
			const result = TodoMapper.toResponse(todo);

			// Then - sortOrder가 올바르게 변환되었는지 검증
			expect(result.sortOrder).toBe(5);
		});

		describe("toResponse - 하위 항목", () => {
			it("items가 빈 배열이면 items=[], itemStats={total:0, completed:0}", () => {
				// Given - 하위 항목이 빈 배열인 Todo 준비
				const todo = TodoBuilder.create("user-123").withItems([]).build();

				// When - Mapper 호출
				const result = TodoMapper.toResponse(todo);

				// Then - items가 빈 배열이고 itemStats가 0인지 검증
				expect(result.items).toEqual([]);
				expect(result.itemStats).toEqual({ total: 0, completed: 0 });
			});

			it("items가 있으면 올바르게 매핑하고 itemStats를 계산한다", () => {
				// Given - 하위 항목이 포함된 Todo 준비
				const items: TodoItemData[] = [
					{
						id: 1,
						title: "하위 항목 1",
						completed: false,
						sortOrder: 0,
						createdAt: new Date("2024-01-01T00:00:00.000Z"),
						updatedAt: new Date("2024-01-01T00:00:00.000Z"),
					},
					{
						id: 2,
						title: "하위 항목 2",
						completed: true,
						sortOrder: 1,
						createdAt: new Date("2024-01-02T00:00:00.000Z"),
						updatedAt: new Date("2024-01-02T00:00:00.000Z"),
					},
				];
				const todo = TodoBuilder.create("user-123").withItems(items).build();

				// When - Mapper 호출
				const result = TodoMapper.toResponse(todo);

				// Then - items가 올바르게 매핑되고 itemStats가 정확한지 검증
				expect(result.items).toHaveLength(2);
				expect(result.items[0]).toEqual({
					id: 1,
					title: "하위 항목 1",
					completed: false,
					sortOrder: 0,
					createdAt: "2024-01-01T00:00:00.000Z",
					updatedAt: "2024-01-01T00:00:00.000Z",
				});
				expect(result.items[1]).toEqual({
					id: 2,
					title: "하위 항목 2",
					completed: true,
					sortOrder: 1,
					createdAt: "2024-01-02T00:00:00.000Z",
					updatedAt: "2024-01-02T00:00:00.000Z",
				});
				expect(result.itemStats).toEqual({ total: 2, completed: 1 });
			});

			it("일부 완료된 items의 itemStats.completed가 정확하다", () => {
				// Given - 3개 중 1개만 완료된 하위 항목 준비
				const items: TodoItemData[] = [
					{
						id: 1,
						title: "항목 1",
						completed: false,
						sortOrder: 0,
						createdAt: new Date("2024-01-01T00:00:00.000Z"),
						updatedAt: new Date("2024-01-01T00:00:00.000Z"),
					},
					{
						id: 2,
						title: "항목 2",
						completed: true,
						sortOrder: 1,
						createdAt: new Date("2024-01-01T00:00:00.000Z"),
						updatedAt: new Date("2024-01-01T00:00:00.000Z"),
					},
					{
						id: 3,
						title: "항목 3",
						completed: false,
						sortOrder: 2,
						createdAt: new Date("2024-01-01T00:00:00.000Z"),
						updatedAt: new Date("2024-01-01T00:00:00.000Z"),
					},
				];
				const todo = TodoBuilder.create("user-123").withItems(items).build();

				// When - Mapper 호출
				const result = TodoMapper.toResponse(todo);

				// Then - itemStats가 정확한지 검증
				expect(result.itemStats).toEqual({ total: 3, completed: 1 });
			});

			it("전부 완료된 items의 itemStats가 정확하다", () => {
				// Given - 모든 하위 항목이 완료된 Todo 준비
				const items: TodoItemData[] = [
					{
						id: 1,
						title: "항목 1",
						completed: true,
						sortOrder: 0,
						createdAt: new Date("2024-01-01T00:00:00.000Z"),
						updatedAt: new Date("2024-01-01T00:00:00.000Z"),
					},
					{
						id: 2,
						title: "항목 2",
						completed: true,
						sortOrder: 1,
						createdAt: new Date("2024-01-01T00:00:00.000Z"),
						updatedAt: new Date("2024-01-01T00:00:00.000Z"),
					},
					{
						id: 3,
						title: "항목 3",
						completed: true,
						sortOrder: 2,
						createdAt: new Date("2024-01-01T00:00:00.000Z"),
						updatedAt: new Date("2024-01-01T00:00:00.000Z"),
					},
				];
				const todo = TodoBuilder.create("user-123").withItems(items).build();

				// When - Mapper 호출
				const result = TodoMapper.toResponse(todo);

				// Then - itemStats가 전부 완료로 정확한지 검증
				expect(result.itemStats).toEqual({ total: 3, completed: 3 });
			});
		});
	});

	describe("toManyResponse", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			// Given - 빈 배열 준비

			// When - Mapper 호출
			const result = TodoMapper.toManyResponse([]);

			// Then - 빈 배열이 반환되는지 검증
			expect(result).toEqual([]);
		});

		it("여러 Todo를 올바르게 변환해야 한다", () => {
			// Given - 여러 Todo 엔티티 배열 준비
			const todos = [
				TodoBuilder.create("user-123")
					.withId(1)
					.withTitle("첫 번째 할 일")
					.build(),
				TodoBuilder.create("user-123")
					.withId(2)
					.withTitle("두 번째 할 일")
					.build(),
				TodoBuilder.create("user-123")
					.withId(3)
					.withTitle("세 번째 할 일")
					.build(),
			];

			// When - Mapper 호출
			const result = TodoMapper.toManyResponse(todos);

			// Then - 여러 Todo가 올바르게 변환되었는지 검증
			expect(result).toHaveLength(3);
			expect(result[0]?.id).toBe(1);
			expect(result[0]?.title).toBe("첫 번째 할 일");
			expect(result[1]?.id).toBe(2);
			expect(result[1]?.title).toBe("두 번째 할 일");
			expect(result[2]?.id).toBe(3);
			expect(result[2]?.title).toBe("세 번째 할 일");
		});

		it("각 Todo가 올바른 형식으로 변환되어야 한다", () => {
			// Given - 단일 Todo 배열 준비
			const todos = [TodoBuilder.create("user-123").build()];

			// When - Mapper 호출
			const result = TodoMapper.toManyResponse(todos);

			// Then - 변환된 응답에 필수 필드가 포함되어 있는지 검증
			expect(result[0]).toHaveProperty("id");
			expect(result[0]).toHaveProperty("userId");
			expect(result[0]).toHaveProperty("title");
			expect(result[0]).toHaveProperty("startDate");
			expect(result[0]).toHaveProperty("category");
			expect(result[0]).toHaveProperty("sortOrder");
			expect(typeof result[0]?.startDate).toBe("string");
		});

		it("각 Todo의 카테고리 정보가 포함되어야 한다", () => {
			// Given - 다양한 카테고리가 포함된 Todo 배열 준비
			const todos = [
				TodoBuilder.create("user-123")
					.withId(1)
					.withCategory({
						id: 1,
						name: "중요한 일",
						color: "#FFB3B3",
						sortOrder: 0,
					})
					.build(),
				TodoBuilder.create("user-123")
					.withId(2)
					.withCategory({
						id: 2,
						name: "할 일",
						color: "#FF6B43",
						sortOrder: 1,
					})
					.build(),
			];

			// When - Mapper 호출
			const result = TodoMapper.toManyResponse(todos);

			// Then - 각 Todo의 카테고리 정보가 올바르게 변환되었는지 검증
			expect(result[0]?.category.name).toBe("중요한 일");
			expect(result[1]?.category.name).toBe("할 일");
		});
	});
});

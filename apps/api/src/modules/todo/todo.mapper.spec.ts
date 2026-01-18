import { type Todo, TodoVisibility } from "@/generated/prisma/client";
import {
	formatDateToString,
	mapTodosToResponse,
	mapTodoToResponse,
} from "./todo.mapper";

describe("Todo Mapper", () => {
	const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
		id: 1,
		userId: "user-123",
		title: "테스트 할 일",
		content: "테스트 내용",
		color: "#FF5733",
		completed: false,
		completedAt: null,
		startDate: new Date("2024-01-15T00:00:00.000Z"),
		endDate: new Date("2024-01-16T00:00:00.000Z"),
		scheduledTime: new Date("2024-01-15T10:00:00.000Z"),
		isAllDay: false,
		visibility: TodoVisibility.PUBLIC,
		createdAt: new Date("2024-01-01T00:00:00.000Z"),
		updatedAt: new Date("2024-01-02T00:00:00.000Z"),
		...overrides,
	});

	describe("formatDateToString", () => {
		it("Date 객체를 YYYY-MM-DD 형식의 문자열로 변환해야 한다", () => {
			const date = new Date("2024-01-15T10:30:00.000Z");
			const result = formatDateToString(date);
			expect(result).toBe("2024-01-15");
		});

		it("월과 일이 한 자리수일 때 0을 패딩해야 한다", () => {
			const date = new Date("2024-03-05T00:00:00.000Z");
			const result = formatDateToString(date);
			expect(result).toBe("2024-03-05");
		});
	});

	describe("mapTodoToResponse", () => {
		it("Todo 엔티티를 올바른 응답 형식으로 변환해야 한다", () => {
			const todo = createMockTodo();
			const result = mapTodoToResponse(todo);

			expect(result).toEqual({
				id: 1,
				userId: "user-123",
				title: "테스트 할 일",
				content: "테스트 내용",
				color: "#FF5733",
				completed: false,
				completedAt: null,
				startDate: "2024-01-15",
				endDate: "2024-01-16",
				scheduledTime: "2024-01-15T10:00:00.000Z",
				isAllDay: false,
				visibility: "PUBLIC",
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			});
		});

		it("완료된 Todo를 올바르게 변환해야 한다", () => {
			const completedAt = new Date("2024-01-15T15:00:00.000Z");
			const todo = createMockTodo({
				completed: true,
				completedAt,
			});
			const result = mapTodoToResponse(todo);

			expect(result.completed).toBe(true);
			expect(result.completedAt).toBe("2024-01-15T15:00:00.000Z");
		});

		it("null 값들을 올바르게 처리해야 한다", () => {
			const todo = createMockTodo({
				content: null,
				color: null,
				endDate: null,
				scheduledTime: null,
			});
			const result = mapTodoToResponse(todo);

			expect(result.content).toBeNull();
			expect(result.color).toBeNull();
			expect(result.endDate).toBeNull();
			expect(result.scheduledTime).toBeNull();
		});

		it("PRIVATE visibility를 올바르게 처리해야 한다", () => {
			const todo = createMockTodo({
				visibility: TodoVisibility.PRIVATE,
			});
			const result = mapTodoToResponse(todo);

			expect(result.visibility).toBe("PRIVATE");
		});

		it("하루 종일 Todo를 올바르게 변환해야 한다", () => {
			const todo = createMockTodo({
				isAllDay: true,
				scheduledTime: null,
			});
			const result = mapTodoToResponse(todo);

			expect(result.isAllDay).toBe(true);
			expect(result.scheduledTime).toBeNull();
		});
	});

	describe("mapTodosToResponse", () => {
		it("빈 배열을 올바르게 처리해야 한다", () => {
			const result = mapTodosToResponse([]);
			expect(result).toEqual([]);
		});

		it("여러 Todo를 올바르게 변환해야 한다", () => {
			const todos = [
				createMockTodo({ id: 1, title: "첫 번째 할 일" }),
				createMockTodo({ id: 2, title: "두 번째 할 일" }),
				createMockTodo({ id: 3, title: "세 번째 할 일" }),
			];
			const result = mapTodosToResponse(todos);

			expect(result).toHaveLength(3);
			expect(result[0]?.id).toBe(1);
			expect(result[0]?.title).toBe("첫 번째 할 일");
			expect(result[1]?.id).toBe(2);
			expect(result[1]?.title).toBe("두 번째 할 일");
			expect(result[2]?.id).toBe(3);
			expect(result[2]?.title).toBe("세 번째 할 일");
		});

		it("각 Todo가 올바른 형식으로 변환되어야 한다", () => {
			const todos = [createMockTodo()];
			const result = mapTodosToResponse(todos);

			expect(result[0]).toHaveProperty("id");
			expect(result[0]).toHaveProperty("userId");
			expect(result[0]).toHaveProperty("title");
			expect(result[0]).toHaveProperty("startDate");
			expect(typeof result[0]?.startDate).toBe("string");
		});
	});
});

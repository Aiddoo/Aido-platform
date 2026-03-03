import type { Todo } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import type {
	CreateRecurringTodoDto,
	CreateTodoDto,
	GetTodosQueryDto,
	TodoIdParamDto,
} from "./dtos";
import { TodoController } from "./todo.controller";
import { TodoService } from "./todo.service";

describe("TodoController", () => {
	let controller: TodoController;
	let mockTodoService: Mocked<TodoService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(TodoController).compile();

		controller = unit;
		mockTodoService = unitRef.get(TodoService);
	});

	describe("create", () => {
		it("할 일 생성 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given: 할 일 생성 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				title: "팀 미팅",
				categoryId: 1,
				startDate: "2026-02-22",
				isAllDay: true,
				visibility: "PUBLIC",
			} as unknown as CreateTodoDto;
			const tz = "Asia/Seoul";
			const mockTodo = TodoBuilder.create("user-123")
				.withId(1)
				.withTitle("팀 미팅")
				.withStartDate(new Date("2026-02-22"))
				.withIsAllDay(true)
				.build() as unknown as Todo;
			mockTodoService.create.mockResolvedValue(mockTodo);

			// When: create를 호출하면
			const result = await controller.create(mockUser, dto, tz);

			// Then: 서비스에 변환된 데이터를 전달하고 응답을 반환해야 한다
			expect(mockTodoService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.userId,
					title: dto.title,
					categoryId: dto.categoryId,
					isAllDay: dto.isAllDay,
					visibility: dto.visibility,
				}),
			);
			expect(result).toEqual({
				message: "할 일이 생성되었습니다.",
				todo: mockTodo,
			});
		});
	});

	describe("findMany", () => {
		it("할 일 목록 조회 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given: 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = { size: 20 } as unknown as GetTodosQueryDto;
			const serviceResult = {
				items: [
					TodoBuilder.create("user-123").withId(1).withTitle("할 일 1").build(),
					TodoBuilder.create("user-123").withId(2).withTitle("할 일 2").build(),
				] as unknown as Todo[],
				pagination: {
					hasNext: false,
					nextCursor: null,
					size: 20,
				},
			};
			mockTodoService.findMany.mockResolvedValue(serviceResult);

			// When: findMany를 호출하면
			const result = await controller.findMany(mockUser, query);

			// Then: 서비스에 userId를 포함한 쿼리를 전달하고 결과를 반환해야 한다
			expect(mockTodoService.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.userId,
					size: query.size,
				}),
			);
			expect(result).toEqual({
				items: serviceResult.items,
				pagination: serviceResult.pagination,
			});
		});

		it("날짜 필터가 있으면 변환하여 서비스에 전달해야 한다", async () => {
			// Given: 날짜 필터가 포함된 쿼리가 있을 때
			const query = {
				size: 20,
				startDate: "2026-02-01",
				endDate: "2026-02-28",
			} as unknown as GetTodosQueryDto;
			const serviceResult = {
				items: [] as Todo[],
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			};
			mockTodoService.findMany.mockResolvedValue(serviceResult);

			// When: findMany를 호출하면
			const result = await controller.findMany(mockUser, query);

			// Then: 날짜가 parseDateOnly로 변환되어 서비스에 전달되어야 한다
			expect(mockTodoService.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.userId,
					startDate: expect.any(Date),
					endDate: expect.any(Date),
				}),
			);
			expect(result).toEqual({
				items: [],
				pagination: serviceResult.pagination,
			});
		});
	});

	describe("createRecurring", () => {
		it("반복 할 일 생성 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given: 반복 할 일 생성 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				title: "약 먹기",
				categoryId: 1,
				startDate: "2026-03-01",
				endDate: "2026-03-31",
				daysOfWeek: ["MON", "WED", "FRI"],
			} as unknown as CreateRecurringTodoDto;
			const tz = "Asia/Seoul";
			const mockTodos = [
				TodoBuilder.create("user-123").withTitle("약 먹기").withId(1).build(),
				TodoBuilder.create("user-123").withTitle("약 먹기").withId(2).build(),
				TodoBuilder.create("user-123").withTitle("약 먹기").withId(3).build(),
			] as unknown as Todo[];
			mockTodoService.createRecurring.mockResolvedValue({
				todos: mockTodos,
				count: 3,
			});

			// When: createRecurring을 호출하면
			const result = await controller.createRecurring(mockUser, dto, tz);

			// Then: 서비스에 데이터를 전달하고 응답을 반환해야 한다
			expect(mockTodoService.createRecurring).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.userId,
					title: dto.title,
					categoryId: dto.categoryId,
					startDate: dto.startDate,
					endDate: dto.endDate,
					daysOfWeek: dto.daysOfWeek,
				}),
				tz,
			);
			expect(result).toEqual({
				message: "반복 할 일이 3개 생성되었습니다.",
				todos: mockTodos,
				count: 3,
			});
		});

		it("생성된 수에 맞는 메시지를 반환해야 한다", async () => {
			// Given: 13개의 반복 할 일이 생성되는 경우
			const dto = {
				title: "운동하기",
				categoryId: 2,
				startDate: "2026-03-01",
				endDate: "2026-03-31",
				daysOfWeek: ["MON", "WED", "FRI"],
			} as unknown as CreateRecurringTodoDto;
			const mockTodos = Array.from(
				{ length: 13 },
				(_, i) =>
					TodoBuilder.create("user-123")
						.withTitle("운동하기")
						.withId(i + 1)
						.build() as unknown as Todo,
			);
			mockTodoService.createRecurring.mockResolvedValue({
				todos: mockTodos,
				count: 13,
			});

			// When: createRecurring을 호출하면
			const result = await controller.createRecurring(mockUser, dto, "UTC");

			// Then: 생성 개수가 메시지에 반영되어야 한다
			expect(result.message).toBe("반복 할 일이 13개 생성되었습니다.");
			expect(result.count).toBe(13);
		});
	});

	describe("delete", () => {
		it("할 일 삭제 요청을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given: 삭제할 할 일 ID가 있을 때
			const params = { id: 1 } as unknown as TodoIdParamDto;
			mockTodoService.delete.mockResolvedValue(undefined);

			// When: delete를 호출하면
			const result = await controller.delete(mockUser, params);

			// Then: 서비스에 id와 userId를 전달하고 메시지를 반환해야 한다
			expect(mockTodoService.delete).toHaveBeenCalledWith(
				params.id,
				mockUser.userId,
			);
			expect(result).toEqual({
				message: "할 일이 삭제되었습니다.",
			});
		});
	});
});

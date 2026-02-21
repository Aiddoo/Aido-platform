import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

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
		mockTodoService = unitRef.get(
			TodoService,
		) as unknown as Mocked<TodoService>;
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
			};
			const tz = "Asia/Seoul";
			const mockTodo = {
				id: 1,
				title: "팀 미팅",
				startDate: new Date("2026-02-22"),
				isAllDay: true,
				completed: false,
			};
			mockTodoService.create.mockResolvedValue(mockTodo as any);

			// When: create를 호출하면
			const result = await controller.create(mockUser, dto as any, tz);

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
			const query = { size: 20 };
			const serviceResult = {
				items: [
					{ id: 1, title: "할 일 1" },
					{ id: 2, title: "할 일 2" },
				],
				pagination: {
					hasNext: false,
					nextCursor: null,
				},
			};
			mockTodoService.findMany.mockResolvedValue(serviceResult as any);

			// When: findMany를 호출하면
			const result = await controller.findMany(mockUser, query as any);

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
			};
			const serviceResult = {
				items: [],
				pagination: { hasNext: false, nextCursor: null },
			};
			mockTodoService.findMany.mockResolvedValue(serviceResult as any);

			// When: findMany를 호출하면
			const result = await controller.findMany(mockUser, query as any);

			// Then: 날짜가 toDateOnly로 변환되어 서비스에 전달되어야 한다
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

	describe("delete", () => {
		it("할 일 삭제 요청을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given: 삭제할 할 일 ID가 있을 때
			const params = { id: 1 };
			mockTodoService.delete.mockResolvedValue(undefined as any);

			// When: delete를 호출하면
			const result = await controller.delete(mockUser, params as any);

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

/**
 * TodoController 컨트롤러 단위 테스트
 *
 * @description
 * TodoController의 엔드포인트 핸들러를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo.controller
 * ```
 */
import type { Todo as TodoResponse } from "@aido/validators";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import { CreateTodoCommand } from "./application/use-cases/create-todo/create-todo.command";
import type {
	CreateRecurringTodoDto,
	CreateTodoDto,
	GetTodosQueryDto,
	TodoIdParamDto,
} from "./dtos";
import { TodoController } from "./todo.controller";
import { TodoMapper } from "./todo.mapper";
import { TodoService } from "./todo.service";
import type { TodoWithCategory } from "./types/todo.types";

/** 응답 read model(TodoResponse) 생성 헬퍼 — 행을 매핑해 계약 형태를 보장한다 */
function buildResponse(
	overrides: Partial<TodoWithCategory> = {},
): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("user-123")
			.withId(overrides.id ?? 1)
			.withTitle(overrides.title ?? "팀 미팅")
			.build(),
	);
}

/** 타입 지정 CreateTodoDto 팩토리 (as 캐스팅 없이 부분 오버라이드) */
function makeCreateTodoDto(
	overrides: Partial<CreateTodoDto> = {},
): CreateTodoDto {
	return {
		title: "팀 미팅",
		categoryId: 1,
		startDate: "2026-02-22",
		isAllDay: true,
		visibility: "PUBLIC",
		...overrides,
	};
}

/** 타입 지정 GetTodosQueryDto 팩토리 */
function makeGetTodosQueryDto(
	overrides: Partial<GetTodosQueryDto> = {},
): GetTodosQueryDto {
	return { size: 20, ...overrides };
}

/** 타입 지정 CreateRecurringTodoDto 팩토리 */
function makeRecurringDto(
	overrides: Partial<CreateRecurringTodoDto> = {},
): CreateRecurringTodoDto {
	return {
		title: "약 먹기",
		categoryId: 1,
		startDate: "2026-03-01",
		endDate: "2026-03-31",
		daysOfWeek: ["MON", "WED", "FRI"],
		isAllDay: true,
		visibility: "PUBLIC",
		...overrides,
	};
}

describe("TodoController — 할 일 컨트롤러", () => {
	let controller: TodoController;
	let mockTodoService: Mocked<TodoService>;
	let mockCommandBus: Mocked<CommandBus>;
	let mockQueryBus: Mocked<QueryBus>;

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
		mockCommandBus = unitRef.get(CommandBus);
		mockQueryBus = unitRef.get(QueryBus);
	});

	describe("create", () => {
		it("할 일 생성 요청을 CommandBus에 위임하고 응답 read model을 반환해야 한다", async () => {
			// Given - 할 일 생성 DTO와 커맨드 핸들러가 반환할 응답이 준비되었을 때
			const dto = makeCreateTodoDto({ title: "팀 미팅" });
			const tz = "Asia/Seoul";
			const response = buildResponse({ title: "팀 미팅" });
			mockCommandBus.execute.mockResolvedValue(response);

			// When - create를 호출하면
			const result = await controller.create(mockUser, dto, tz);

			// Then - CreateTodoCommand를 디스패치하고 응답을 그대로 반환해야 한다
			expect(mockCommandBus.execute).toHaveBeenCalledWith(
				expect.any(CreateTodoCommand),
			);
			const command = mockCommandBus.execute.mock.calls[0]?.[0];
			expect(command).toBeInstanceOf(CreateTodoCommand);
			if (command instanceof CreateTodoCommand) {
				expect(command.data).toEqual(
					expect.objectContaining({
						userId: mockUser.userId,
						title: dto.title,
						categoryId: dto.categoryId,
						isAllDay: dto.isAllDay,
						visibility: dto.visibility,
					}),
				);
			}
			expect(result).toEqual({
				message: "할 일이 생성되었습니다.",
				todo: response,
			});
		});
	});

	describe("findMany", () => {
		it("할 일 목록 조회 요청을 QueryBus에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 목록 조회 쿼리와 쿼리 핸들러 응답이 준비되었을 때
			const query = makeGetTodosQueryDto();
			const queryResult = {
				items: [
					buildResponse({ id: 1, title: "할 일 1" }),
					buildResponse({ id: 2, title: "할 일 2" }),
				],
				pagination: {
					hasNext: false,
					nextCursor: null,
					size: 20,
				},
			};
			mockQueryBus.execute.mockResolvedValue(queryResult);

			// When - findMany를 호출하면
			const result = await controller.findMany(mockUser, query);

			// Then - userId를 포함한 GetTodosQuery를 디스패치하고 결과를 반환해야 한다
			expect(mockQueryBus.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					params: expect.objectContaining({
						userId: mockUser.userId,
						size: query.size,
					}),
				}),
			);
			expect(result).toEqual({
				items: queryResult.items,
				pagination: queryResult.pagination,
			});
		});

		it("날짜 필터가 있으면 변환하여 쿼리에 전달해야 한다", async () => {
			// Given - 날짜 필터가 포함된 쿼리가 있을 때
			const query = makeGetTodosQueryDto({
				startDate: "2026-02-01",
				endDate: "2026-02-28",
			});
			const queryResult = {
				items: [],
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			};
			mockQueryBus.execute.mockResolvedValue(queryResult);

			// When - findMany를 호출하면
			const result = await controller.findMany(mockUser, query);

			// Then - 날짜가 parseDateOnly로 변환되어 쿼리에 전달되어야 한다
			expect(mockQueryBus.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					params: expect.objectContaining({
						userId: mockUser.userId,
						startDate: expect.any(Date),
						endDate: expect.any(Date),
					}),
				}),
			);
			expect(result).toEqual({
				items: [],
				pagination: queryResult.pagination,
			});
		});
	});

	describe("createRecurring", () => {
		it("반복 할 일 생성 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given - 반복 할 일 생성 DTO와 서비스 응답이 준비되었을 때
			const dto = makeRecurringDto();
			const tz = "Asia/Seoul";
			const mockTodos = [
				buildResponse({ id: 1, title: "약 먹기" }),
				buildResponse({ id: 2, title: "약 먹기" }),
				buildResponse({ id: 3, title: "약 먹기" }),
			];
			mockTodoService.createRecurring.mockResolvedValue({
				todos: mockTodos,
				count: 3,
			});

			// When - createRecurring을 호출하면
			const result = await controller.createRecurring(mockUser, dto, tz);

			// Then - 서비스에 데이터를 전달하고 응답을 반환해야 한다
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
			// Given - 13개의 반복 할 일이 생성되는 경우
			const dto = makeRecurringDto({ title: "운동하기", categoryId: 2 });
			const mockTodos = Array.from({ length: 13 }, (_, i) =>
				buildResponse({ id: i + 1, title: "운동하기" }),
			);
			mockTodoService.createRecurring.mockResolvedValue({
				todos: mockTodos,
				count: 13,
			});

			// When - createRecurring을 호출하면
			const result = await controller.createRecurring(mockUser, dto, "UTC");

			// Then - 생성 개수가 메시지에 반영되어야 한다
			expect(result.message).toBe("반복 할 일이 13개 생성되었습니다.");
			expect(result.count).toBe(13);
		});
	});

	describe("delete", () => {
		it("할 일 삭제 요청을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given - 삭제할 할 일 ID가 있을 때
			const params: TodoIdParamDto = { id: 1 };
			mockTodoService.delete.mockResolvedValue(undefined);

			// When - delete를 호출하면
			const result = await controller.delete(mockUser, params);

			// Then - 서비스에 id와 userId를 전달하고 메시지를 반환해야 한다
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

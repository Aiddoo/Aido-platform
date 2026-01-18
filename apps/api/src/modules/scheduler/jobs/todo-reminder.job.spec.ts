import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { TodoReminderJob } from "./todo-reminder.job";

// =============================================================================
// Mock Factory Functions
// =============================================================================

interface TodoToNotify {
	id: number;
	title: string;
	userId: string;
}

function createMockTodoToNotify(
	overrides: Partial<TodoToNotify> = {},
): TodoToNotify {
	return {
		id: overrides.id ?? 1,
		title: overrides.title ?? "Test Todo",
		userId: overrides.userId ?? "user-1",
	};
}

// =============================================================================
// Mock Setup
// =============================================================================

const mockDatabaseService = {
	todo: {
		findMany: jest.fn(),
	},
};

const mockNotificationService = {
	createAndSendBatch: jest.fn(),
};

// =============================================================================
// Tests
// =============================================================================

describe("TodoReminderJob", () => {
	let job: TodoReminderJob;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TodoReminderJob,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: NotificationService,
					useValue: mockNotificationService,
				},
			],
		}).compile();

		job = module.get<TodoReminderJob>(TodoReminderJob);
	});

	// =========================================================================
	// handleTodoReminder
	// =========================================================================

	describe("handleTodoReminder", () => {
		describe("정상 처리", () => {
			it("마감 임박 할일에 대해 알림을 발송한다", async () => {
				// Given
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: "Task 1", userId: "user-1" }),
					createMockTodoToNotify({ id: 2, title: "Task 2", userId: "user-2" }),
				];

				mockDatabaseService.todo.findMany.mockResolvedValue(todos);
				mockNotificationService.createAndSendBatch.mockResolvedValue({
					count: 2,
				});

				// When
				await job.handleTodoReminder();

				// Then
				expect(mockDatabaseService.todo.findMany).toHaveBeenCalledTimes(1);
				expect(
					mockNotificationService.createAndSendBatch,
				).toHaveBeenCalledTimes(1);

				const batchCallArg =
					mockNotificationService.createAndSendBatch.mock.calls[0][0];
				expect(batchCallArg).toHaveLength(2);

				// 첫 번째 알림 확인
				expect(batchCallArg[0]).toMatchObject({
					userId: "user-1",
					type: "TODO_REMINDER",
					route: "/todos/1",
					todoId: 1,
				});
				expect(batchCallArg[0].title).toBeDefined();
				expect(batchCallArg[0].body).toBeDefined();
			});

			it("할일 제목이 포함된 알림을 생성한다", async () => {
				// Given
				const todoTitle = "중요한 회의 준비";
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: todoTitle, userId: "user-1" }),
				];

				mockDatabaseService.todo.findMany.mockResolvedValue(todos);
				mockNotificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When
				await job.handleTodoReminder();

				// Then
				const batchCallArg =
					mockNotificationService.createAndSendBatch.mock.calls[0][0];
				expect(batchCallArg[0].route).toBe("/todos/1");
				expect(batchCallArg[0].todoId).toBe(1);
			});
		});

		describe("중복 알림 방지", () => {
			it("이미 알림을 보낸 할일에는 다시 알림을 보내지 않는다", async () => {
				// Given - 첫 번째 실행
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 100, title: "Task", userId: "user-1" }),
				];

				mockDatabaseService.todo.findMany.mockResolvedValue(todos);
				mockNotificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 첫 번째 실행
				await job.handleTodoReminder();

				// Then - 첫 번째 실행에서 알림 발송
				expect(
					mockNotificationService.createAndSendBatch,
				).toHaveBeenCalledTimes(1);

				// Given - 두 번째 실행 (같은 할일)
				jest.clearAllMocks();
				mockDatabaseService.todo.findMany.mockResolvedValue(todos);

				// When - 두 번째 실행
				await job.handleTodoReminder();

				// Then - 두 번째 실행에서는 알림 발송하지 않음 (이미 캐시에 있음)
				expect(mockDatabaseService.todo.findMany).toHaveBeenCalledTimes(1);
				expect(
					mockNotificationService.createAndSendBatch,
				).not.toHaveBeenCalled();
			});

			it("새로운 할일에만 알림을 보내고 기존 할일은 제외한다", async () => {
				// Given - 첫 번째 실행
				const firstTodos: TodoToNotify[] = [
					createMockTodoToNotify({
						id: 200,
						title: "Task 1",
						userId: "user-1",
					}),
				];

				mockDatabaseService.todo.findMany.mockResolvedValue(firstTodos);
				mockNotificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 첫 번째 실행
				await job.handleTodoReminder();

				// Given - 두 번째 실행 (기존 + 새로운 할일)
				jest.clearAllMocks();
				const secondTodos: TodoToNotify[] = [
					createMockTodoToNotify({
						id: 200,
						title: "Task 1",
						userId: "user-1",
					}), // 기존
					createMockTodoToNotify({
						id: 201,
						title: "Task 2",
						userId: "user-2",
					}), // 새로운
				];

				mockDatabaseService.todo.findMany.mockResolvedValue(secondTodos);
				mockNotificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 두 번째 실행
				await job.handleTodoReminder();

				// Then - 새로운 할일(201)에만 알림 발송
				expect(
					mockNotificationService.createAndSendBatch,
				).toHaveBeenCalledTimes(1);
				const batchCallArg =
					mockNotificationService.createAndSendBatch.mock.calls[0][0];
				expect(batchCallArg).toHaveLength(1);
				expect(batchCallArg[0].todoId).toBe(201);
			});
		});

		describe("알림 대상 없음", () => {
			it("마감 임박 할일이 없으면 알림을 발송하지 않는다", async () => {
				// Given
				mockDatabaseService.todo.findMany.mockResolvedValue([]);

				// When
				await job.handleTodoReminder();

				// Then
				expect(mockDatabaseService.todo.findMany).toHaveBeenCalledTimes(1);
				expect(
					mockNotificationService.createAndSendBatch,
				).not.toHaveBeenCalled();
			});
		});

		describe("에러 처리", () => {
			it("데이터베이스 조회 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given
				const error = new Error("Database connection failed");
				mockDatabaseService.todo.findMany.mockRejectedValue(error);

				// When & Then
				await expect(job.handleTodoReminder()).resolves.not.toThrow();
				expect(
					mockNotificationService.createAndSendBatch,
				).not.toHaveBeenCalled();
			});

			it("알림 발송 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 300, title: "Task", userId: "user-1" }),
				];
				mockDatabaseService.todo.findMany.mockResolvedValue(todos);

				const error = new Error("Push notification failed");
				mockNotificationService.createAndSendBatch.mockRejectedValue(error);

				// When & Then
				await expect(job.handleTodoReminder()).resolves.not.toThrow();
			});
		});

		describe("시간 범위 계산", () => {
			it("50분~60분 후 마감인 할일을 조회한다", async () => {
				// Given
				mockDatabaseService.todo.findMany.mockResolvedValue([]);

				// When
				await job.handleTodoReminder();

				// Then
				const findManyCall = mockDatabaseService.todo.findMany.mock.calls[0][0];

				// where 조건 확인
				expect(findManyCall.where).toBeDefined();
				expect(findManyCall.where.scheduledTime).toBeDefined();
				expect(findManyCall.where.scheduledTime.gte).toBeInstanceOf(Date);
				expect(findManyCall.where.scheduledTime.lt).toBeInstanceOf(Date);
				expect(findManyCall.where.completed).toBe(false);
				expect(findManyCall.where.user).toEqual({ pushTokens: { some: {} } });

				// select 조건 확인
				expect(findManyCall.select).toBeDefined();
				expect(findManyCall.select.id).toBe(true);
				expect(findManyCall.select.title).toBe(true);
				expect(findManyCall.select.userId).toBe(true);
			});
		});
	});

	// =========================================================================
	// cleanupOldCache (private method - 간접 테스트)
	// =========================================================================

	describe("캐시 정리", () => {
		it("캐시가 1000개를 초과하면 오래된 항목을 정리한다", async () => {
			// Given - 1001개의 할일로 캐시 채우기
			const manyTodos: TodoToNotify[] = [];
			for (let i = 1; i <= 1001; i++) {
				manyTodos.push(
					createMockTodoToNotify({
						id: i,
						title: `Task ${i}`,
						userId: `user-${i}`,
					}),
				);
			}

			mockDatabaseService.todo.findMany.mockResolvedValue(manyTodos);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 1001,
			});

			// When - 1001개 처리
			await job.handleTodoReminder();

			// Then - 알림은 발송되었어야 함
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalledTimes(
				1,
			);

			// 캐시 정리 후 새로운 할일에 대해 알림이 가능한지 확인
			jest.clearAllMocks();

			// 초기 500개가 정리되었으므로 1~500 범위의 할일은 다시 알림 가능
			const newTodos: TodoToNotify[] = [
				createMockTodoToNotify({ id: 1, title: "Task 1", userId: "user-1" }),
			];

			mockDatabaseService.todo.findMany.mockResolvedValue(newTodos);
			mockNotificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			await job.handleTodoReminder();

			// 캐시에서 제거되었으므로 다시 알림 발송
			expect(mockNotificationService.createAndSendBatch).toHaveBeenCalledTimes(
				1,
			);
		});
	});
});

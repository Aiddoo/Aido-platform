import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { MorningReminderJob } from "./morning-reminder.job";

// =============================================================================
// Mock Factory Functions
// =============================================================================

interface UserWithTodoCount {
	id: string;
	_count: {
		todos: number;
	};
}

function createMockUserWithTodoCount(
	overrides: Partial<{
		id: string;
		todoCount: number;
	}> = {},
): UserWithTodoCount {
	return {
		id: overrides.id ?? "user-1",
		_count: {
			todos: overrides.todoCount ?? 3,
		},
	};
}

// =============================================================================
// Mock Setup
// =============================================================================

const mockDatabaseService = {
	user: {
		findMany: jest.fn(),
	},
};

const mockNotificationService = {
	createAndSendBatch: jest.fn(),
};

// =============================================================================
// Tests
// =============================================================================

describe("MorningReminderJob", () => {
	let job: MorningReminderJob;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MorningReminderJob,
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

		job = module.get<MorningReminderJob>(MorningReminderJob);
	});

	// =========================================================================
	// handleMorningReminder
	// =========================================================================

	describe("handleMorningReminder", () => {
		describe("정상 처리", () => {
			it("오늘 할일이 있는 사용자들에게 아침 알림을 발송한다", async () => {
				// Given
				const users: UserWithTodoCount[] = [
					createMockUserWithTodoCount({ id: "user-1", todoCount: 3 }),
					createMockUserWithTodoCount({ id: "user-2", todoCount: 5 }),
					createMockUserWithTodoCount({ id: "user-3", todoCount: 1 }),
				];

				mockDatabaseService.user.findMany.mockResolvedValue(users);
				mockNotificationService.createAndSendBatch.mockResolvedValue({
					count: 3,
				});

				// When
				await job.handleMorningReminder();

				// Then
				expect(mockDatabaseService.user.findMany).toHaveBeenCalledTimes(1);
				expect(
					mockNotificationService.createAndSendBatch,
				).toHaveBeenCalledTimes(1);

				const batchCallArg =
					mockNotificationService.createAndSendBatch.mock.calls[0][0];
				expect(batchCallArg).toHaveLength(3);

				// 첫 번째 사용자 알림 확인
				expect(batchCallArg[0]).toMatchObject({
					userId: "user-1",
					type: "MORNING_REMINDER",
					route: "/",
				});
				expect(batchCallArg[0].title).toBeDefined();
				expect(batchCallArg[0].body).toBeDefined();
			});

			it("단일 사용자에게 할일 개수가 포함된 알림을 보낸다", async () => {
				// Given
				const todoCount = 7;
				const users: UserWithTodoCount[] = [
					createMockUserWithTodoCount({ id: "user-1", todoCount }),
				];

				mockDatabaseService.user.findMany.mockResolvedValue(users);
				mockNotificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When
				await job.handleMorningReminder();

				// Then
				const batchCallArg =
					mockNotificationService.createAndSendBatch.mock.calls[0][0];
				expect(batchCallArg).toHaveLength(1);
				expect(batchCallArg[0].userId).toBe("user-1");
				expect(batchCallArg[0].type).toBe("MORNING_REMINDER");
			});
		});

		describe("알림 대상 없음", () => {
			it("오늘 할일이 있는 사용자가 없으면 알림을 발송하지 않는다", async () => {
				// Given
				mockDatabaseService.user.findMany.mockResolvedValue([]);

				// When
				await job.handleMorningReminder();

				// Then
				expect(mockDatabaseService.user.findMany).toHaveBeenCalledTimes(1);
				expect(
					mockNotificationService.createAndSendBatch,
				).not.toHaveBeenCalled();
			});
		});

		describe("에러 처리", () => {
			it("데이터베이스 조회 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given
				const error = new Error("Database connection failed");
				mockDatabaseService.user.findMany.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleMorningReminder()).resolves.not.toThrow();
				expect(
					mockNotificationService.createAndSendBatch,
				).not.toHaveBeenCalled();
			});

			it("알림 발송 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given
				const users: UserWithTodoCount[] = [
					createMockUserWithTodoCount({ id: "user-1", todoCount: 3 }),
				];
				mockDatabaseService.user.findMany.mockResolvedValue(users);

				const error = new Error("Push notification failed");
				mockNotificationService.createAndSendBatch.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleMorningReminder()).resolves.not.toThrow();
			});
		});

		describe("날짜 범위 계산", () => {
			it("오늘 날짜 범위로 사용자를 조회한다", async () => {
				// Given
				mockDatabaseService.user.findMany.mockResolvedValue([]);

				// When
				await job.handleMorningReminder();

				// Then
				const findManyCall = mockDatabaseService.user.findMany.mock.calls[0][0];

				// where 조건 확인
				expect(findManyCall.where).toBeDefined();
				expect(findManyCall.where.pushTokens).toEqual({ some: {} });
				expect(findManyCall.where.todos).toBeDefined();
				expect(findManyCall.where.todos.some).toBeDefined();
				expect(findManyCall.where.todos.some.startDate).toBeDefined();
				expect(findManyCall.where.todos.some.startDate.gte).toBeInstanceOf(
					Date,
				);
				expect(findManyCall.where.todos.some.startDate.lt).toBeInstanceOf(Date);

				// select 조건 확인
				expect(findManyCall.select).toBeDefined();
				expect(findManyCall.select.id).toBe(true);
				expect(findManyCall.select._count).toBeDefined();
			});
		});
	});
});

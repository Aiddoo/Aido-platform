import { type StubbedInstance, TestBed } from "@suites/unit";

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
// Tests
// =============================================================================

describe("MorningReminderJob", () => {
	let job: MorningReminderJob;
	let databaseService: StubbedInstance<DatabaseService>;
	let notificationService: StubbedInstance<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(MorningReminderJob).compile();

		job = unit;
		databaseService = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);
	});

	// =========================================================================
	// handleMorningReminder
	// =========================================================================

	describe("handleMorningReminder", () => {
		describe("정상 처리", () => {
			it("오늘 할일이 있는 사용자들에게 아침 알림을 발송한다", async () => {
				// Given - 오늘 할일이 있는 사용자 3명 준비
				const users: UserWithTodoCount[] = [
					createMockUserWithTodoCount({ id: "user-1", todoCount: 3 }),
					createMockUserWithTodoCount({ id: "user-2", todoCount: 5 }),
					createMockUserWithTodoCount({ id: "user-3", todoCount: 1 }),
				];

				databaseService.user.findMany.mockResolvedValue(users as never);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 3,
				});

				// When - 아침 리마인더 job 실행
				await job.handleMorningReminder();

				// Then - 모든 사용자에게 알림이 전송됨
				expect(databaseService.user.findMany).toHaveBeenCalledTimes(1);
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

				const batchCallArg =
					notificationService.createAndSendBatch.mock.calls[0][0];
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
				// Given - 할일 7개가 있는 단일 사용자 준비
				const todoCount = 7;
				const users: UserWithTodoCount[] = [
					createMockUserWithTodoCount({ id: "user-1", todoCount }),
				];

				databaseService.user.findMany.mockResolvedValue(users as never);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 아침 리마인더 job 실행
				await job.handleMorningReminder();

				// Then - 해당 사용자에게 MORNING_REMINDER 알림이 전송됨
				const batchCallArg =
					notificationService.createAndSendBatch.mock.calls[0][0];
				expect(batchCallArg).toHaveLength(1);
				expect(batchCallArg[0].userId).toBe("user-1");
				expect(batchCallArg[0].type).toBe("MORNING_REMINDER");
			});
		});

		describe("알림 대상 없음", () => {
			it("오늘 할일이 있는 사용자가 없으면 알림을 발송하지 않는다", async () => {
				// Given - 대상 사용자 없음
				databaseService.user.findMany.mockResolvedValue([] as never);

				// When - 아침 리마인더 job 실행
				await job.handleMorningReminder();

				// Then - 알림 발송이 호출되지 않음
				expect(databaseService.user.findMany).toHaveBeenCalledTimes(1);
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
			});
		});

		describe("에러 처리", () => {
			it("데이터베이스 조회 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given - 데이터베이스 에러 발생
				const error = new Error("Database connection failed");
				databaseService.user.findMany.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleMorningReminder()).resolves.not.toThrow();
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
			});

			it("알림 발송 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given - 사용자는 있지만 알림 발송 실패
				const users: UserWithTodoCount[] = [
					createMockUserWithTodoCount({ id: "user-1", todoCount: 3 }),
				];
				databaseService.user.findMany.mockResolvedValue(users as never);

				const error = new Error("Push notification failed");
				notificationService.createAndSendBatch.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleMorningReminder()).resolves.not.toThrow();
			});
		});

		describe("날짜 범위 계산", () => {
			it("오늘 날짜 범위로 사용자를 조회한다", async () => {
				// Given - 빈 결과 반환
				databaseService.user.findMany.mockResolvedValue([] as never);

				// When - 아침 리마인더 job 실행
				await job.handleMorningReminder();

				// Then - 올바른 쿼리 조건으로 조회됨
				const findManyCall = databaseService.user.findMany.mock.calls[0][0];

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

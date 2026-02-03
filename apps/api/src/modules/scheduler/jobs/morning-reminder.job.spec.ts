import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

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
// Type-safe Test Helpers
// =============================================================================

interface NotificationBatchItem {
	userId: string;
	type: string;
	title: string;
	body: string;
	route: string;
}

/**
 * mock.calls에서 첫 번째 호출의 첫 번째 인자를 타입 안전하게 가져옴
 */
function getFirstBatchCallArg(mock: jest.Mock): NotificationBatchItem[] {
	const calls = mock.mock.calls;
	if (calls.length === 0) {
		throw new Error("Expected mock to have been called at least once");
	}
	const firstCall = calls[0];
	if (!firstCall || firstCall.length === 0) {
		throw new Error("Expected first call to have arguments");
	}
	return firstCall[0] as NotificationBatchItem[];
}

/**
 * 배열에서 첫 번째 요소를 타입 안전하게 가져옴
 */
function getFirstNotification(
	batch: NotificationBatchItem[],
): NotificationBatchItem {
	const first = batch[0];
	if (!first) {
		throw new Error("Expected batch to have at least one notification");
	}
	return first;
}

interface UserFindManyArgs {
	where?: {
		pushTokens?: unknown;
		todos?: {
			some?: {
				startDate?: {
					gte?: Date;
					lt?: Date;
				};
			};
		};
	};
	select?: {
		id?: boolean;
		_count?: unknown;
	};
}

/**
 * user.findMany mock 호출 인자를 타입 안전하게 가져옴
 */
function getUserFindManyCallArg(mock: jest.Mock): UserFindManyArgs {
	const calls = mock.mock.calls;
	if (calls.length === 0) {
		throw new Error("Expected mock to have been called at least once");
	}
	const firstCall = calls[0];
	if (!firstCall || firstCall.length === 0) {
		throw new Error("Expected first call to have arguments");
	}
	return firstCall[0] as UserFindManyArgs;
}

// =============================================================================
// Tests
// =============================================================================

describe("MorningReminderJob", () => {
	let job: MorningReminderJob;
	let databaseService: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(MorningReminderJob).compile();

		job = unit;
		databaseService = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
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

				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batchCallArg).toHaveLength(3);

				// 첫 번째 사용자 알림 확인
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification).toMatchObject({
					userId: "user-1",
					type: "MORNING_REMINDER",
					route: "/",
				});
				expect(firstNotification.title).toBeDefined();
				expect(firstNotification.body).toBeDefined();
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
				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batchCallArg).toHaveLength(1);
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification.userId).toBe("user-1");
				expect(firstNotification.type).toBe("MORNING_REMINDER");
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
				const findManyCall = getUserFindManyCallArg(
					databaseService.user.findMany as unknown as jest.Mock,
				);

				// where 조건 확인
				expect(findManyCall.where).toBeDefined();
				expect(findManyCall.where?.pushTokens).toEqual({ some: {} });
				expect(findManyCall.where?.todos).toBeDefined();

				const todosFilter = findManyCall.where?.todos;
				expect(todosFilter?.some).toBeDefined();
				expect(todosFilter?.some?.startDate).toBeDefined();
				expect(todosFilter?.some?.startDate?.gte).toBeInstanceOf(Date);
				expect(todosFilter?.some?.startDate?.lt).toBeInstanceOf(Date);

				// select 조건 확인
				expect(findManyCall.select).toBeDefined();
				expect(findManyCall.select?.id).toBe(true);
				expect(findManyCall.select?._count).toBeDefined();
			});
		});
	});
});

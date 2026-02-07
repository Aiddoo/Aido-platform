import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { EveningReminderJob } from "./evening-reminder.job";

// =============================================================================
// Mock Factory Functions
// =============================================================================

interface TodoStatus {
	completed: boolean;
}

interface UserWithTodoStats {
	id: string;
	todos: TodoStatus[];
}

function createMockUserWithTodoStats(
	overrides: Partial<{
		id: string;
		completedCount: number;
		totalCount: number;
	}> = {},
): UserWithTodoStats {
	const totalCount = overrides.totalCount ?? 5;
	const completedCount = overrides.completedCount ?? 3;

	const todos: TodoStatus[] = [];
	for (let i = 0; i < totalCount; i++) {
		todos.push({ completed: i < completedCount });
	}

	return {
		id: overrides.id ?? "user-1",
		todos,
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
		todos?: unknown;
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

describe("EveningReminderJob", () => {
	let job: EveningReminderJob;
	let databaseService: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(EveningReminderJob).compile();

		job = unit;
		databaseService = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
	});

	// =========================================================================
	// handleEveningReminder
	// =========================================================================

	describe("handleEveningReminder", () => {
		describe("완료 상태별 알림", () => {
			it("모든 할일을 완료한 사용자에게 완료 알림을 보낸다", async () => {
				// Given - 5개 중 5개 완료한 사용자 준비
				const users: UserWithTodoStats[] = [
					createMockUserWithTodoStats({
						id: "user-1",
						completedCount: 5,
						totalCount: 5,
					}),
				];

				databaseService.user.findMany.mockResolvedValue(users as never);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 저녁 리마인더 job 실행
				await job.handleEveningReminder();

				// Then - 완료 알림이 전송됨
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batchCallArg).toHaveLength(1);
				expect(batchCallArg[0]).toMatchObject({
					userId: "user-1",
					type: "EVENING_REMINDER",
				});
			});

			it("일부 할일만 완료한 사용자에게 부분 완료 알림을 보낸다", async () => {
				// Given - 5개 중 3개 완료한 사용자 준비
				const users: UserWithTodoStats[] = [
					createMockUserWithTodoStats({
						id: "user-1",
						completedCount: 3,
						totalCount: 5,
					}),
				];

				databaseService.user.findMany.mockResolvedValue(users as never);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 저녁 리마인더 job 실행
				await job.handleEveningReminder();

				// Then - 부분 완료 알림이 전송됨
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification.userId).toBe("user-1");
				expect(firstNotification.type).toBe("EVENING_REMINDER");
			});

			it("부분 완료 시 title에 {remaining}이 실제 숫자로 치환된다", async () => {
				// Given - 5개 중 2개 완료한 사용자 준비 (remaining = 5 - 2 = 3)
				const users: UserWithTodoStats[] = [
					createMockUserWithTodoStats({
						id: "user-1",
						completedCount: 2,
						totalCount: 5,
					}),
				];

				databaseService.user.findMany.mockResolvedValue(users as never);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 저녁 리마인더 job 실행
				await job.handleEveningReminder();

				// Then - title에 {remaining} 플레이스홀더가 남아있지 않고 실제 숫자로 치환됨
				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification.title).not.toContain("{remaining}");
				expect(firstNotification.title).toContain("3");
			});

			it("할일을 하나도 완료하지 않은 사용자에게 미완료 알림을 보낸다", async () => {
				// Given - 5개 중 0개 완료한 사용자 준비
				const users: UserWithTodoStats[] = [
					createMockUserWithTodoStats({
						id: "user-1",
						completedCount: 0,
						totalCount: 5,
					}),
				];

				databaseService.user.findMany.mockResolvedValue(users as never);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 저녁 리마인더 job 실행
				await job.handleEveningReminder();

				// Then - 미완료 알림이 전송됨
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification.userId).toBe("user-1");
				expect(firstNotification.type).toBe("EVENING_REMINDER");
			});
		});

		describe("다수 사용자 처리", () => {
			it("여러 사용자에게 각자의 완료 상태에 맞는 알림을 보낸다", async () => {
				// Given - 완료/부분완료/미완료 사용자 각 1명씩 준비
				const users: UserWithTodoStats[] = [
					createMockUserWithTodoStats({
						id: "user-complete",
						completedCount: 3,
						totalCount: 3,
					}),
					createMockUserWithTodoStats({
						id: "user-partial",
						completedCount: 2,
						totalCount: 5,
					}),
					createMockUserWithTodoStats({
						id: "user-none",
						completedCount: 0,
						totalCount: 4,
					}),
				];

				databaseService.user.findMany.mockResolvedValue(users as never);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 3,
				});

				// When - 저녁 리마인더 job 실행
				await job.handleEveningReminder();

				// Then - 모든 사용자에게 알림이 전송됨
				expect(databaseService.user.findMany).toHaveBeenCalledTimes(1);
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batchCallArg).toHaveLength(3);

				const userIds = batchCallArg.map((n) => n.userId);
				expect(userIds).toContain("user-complete");
				expect(userIds).toContain("user-partial");
				expect(userIds).toContain("user-none");
			});
		});

		describe("알림 대상 없음", () => {
			it("오늘 할일이 있는 사용자가 없으면 알림을 발송하지 않는다", async () => {
				// Given - 대상 사용자 없음
				databaseService.user.findMany.mockResolvedValue([] as never);

				// When - 저녁 리마인더 job 실행
				await job.handleEveningReminder();

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
				await expect(job.handleEveningReminder()).resolves.not.toThrow();
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
			});

			it("알림 발송 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given - 사용자는 있지만 알림 발송 실패
				const users: UserWithTodoStats[] = [
					createMockUserWithTodoStats({ id: "user-1" }),
				];
				databaseService.user.findMany.mockResolvedValue(users as never);

				const error = new Error("Push notification failed");
				notificationService.createAndSendBatch.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleEveningReminder()).resolves.not.toThrow();
			});
		});

		describe("날짜 범위 계산", () => {
			it("오늘 날짜 범위로 사용자를 조회한다", async () => {
				// Given - 빈 결과 반환
				databaseService.user.findMany.mockResolvedValue([] as never);

				// When - 저녁 리마인더 job 실행
				await job.handleEveningReminder();

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
				expect(findManyCall.select?.todos).toBeDefined();
			});
		});
	});
});

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

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
// Type-safe Test Helpers
// =============================================================================

interface NotificationBatchItem {
	userId: string;
	type: string;
	title: string;
	body: string;
	todoId: number;
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

interface TodoFindManyArgs {
	where?: {
		scheduledTime?: {
			gte?: Date;
			lt?: Date;
		};
		completed?: boolean;
		user?: unknown;
	};
	select?: {
		id?: boolean;
		title?: boolean;
		userId?: boolean;
	};
}

/**
 * todo.findMany mock 호출 인자를 타입 안전하게 가져옴
 */
function getTodoFindManyCallArg(mock: jest.Mock): TodoFindManyArgs {
	const calls = mock.mock.calls;
	if (calls.length === 0) {
		throw new Error("Expected mock to have been called at least once");
	}
	const firstCall = calls[0];
	if (!firstCall || firstCall.length === 0) {
		throw new Error("Expected first call to have arguments");
	}
	return firstCall[0] as TodoFindManyArgs;
}

// =============================================================================
// Tests
// =============================================================================

describe("TodoReminderJob", () => {
	let job: TodoReminderJob;
	let databaseService: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(TodoReminderJob).compile();

		job = unit;
		databaseService = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
	});

	/**
	 * DB 기반 중복 알림 조회 mock 설정 헬퍼
	 */
	const setupNotificationFindMany = (alreadyNotifiedTodoIds: number[] = []) => {
		Object.defineProperty(databaseService, "notification", {
			value: {
				findMany: jest
					.fn()
					.mockResolvedValue(
						alreadyNotifiedTodoIds.map((todoId) => ({ todoId })),
					),
			},
			configurable: true,
			writable: true,
		});
	};

	// =========================================================================
	// handleTodoReminder
	// =========================================================================

	describe("handleTodoReminder", () => {
		describe("정상 처리", () => {
			it("마감 임박 할일에 대해 알림을 발송한다", async () => {
				// Given - 마감 임박 할일 2개 준비
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: "Task 1", userId: "user-1" }),
					createMockTodoToNotify({ id: 2, title: "Task 2", userId: "user-2" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]); // 기존 알림 없음
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 2,
				});

				// When - 할일 리마인더 job 실행
				await job.handleTodoReminder();

				// Then - 모든 할일에 대해 알림이 전송됨
				expect(databaseService.todo.findMany).toHaveBeenCalledTimes(1);
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batchCallArg).toHaveLength(2);

				// 첫 번째 알림 확인
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification).toMatchObject({
					userId: "user-1",
					type: "TODO_REMINDER",
					todoId: 1,
				});
				expect(firstNotification.title).toBeDefined();
				expect(firstNotification.body).toBeDefined();
			});

			it("할일 제목이 포함된 알림을 생성한다", async () => {
				// Given - 특정 제목의 할일 준비
				const todoTitle = "중요한 회의 준비";
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: todoTitle, userId: "user-1" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]);
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When - 할일 리마인더 job 실행
				await job.handleTodoReminder();

				// Then - 할일 정보가 포함된 알림이 생성됨
				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification.todoId).toBe(1);
			});
		});

		describe("중복 알림 방지 (DB 기반)", () => {
			it("이미 알림을 보낸 할일에는 다시 알림을 보내지 않는다", async () => {
				// Given - 할일이 있지만, 이미 DB에 알림 기록이 존재
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 100, title: "Task", userId: "user-1" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([100]); // 이미 알림 발송됨

				// When
				await job.handleTodoReminder();

				// Then - 알림 발송하지 않음
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
			});

			it("새로운 할일에만 알림을 보내고 기존 할일은 제외한다", async () => {
				// Given - 기존 알림 있는 할일 + 새로운 할일
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({
						id: 200,
						title: "Task 1",
						userId: "user-1",
					}),
					createMockTodoToNotify({
						id: 201,
						title: "Task 2",
						userId: "user-2",
					}),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([200]); // 200은 이미 알림됨
				notificationService.createAndSendBatch.mockResolvedValue({
					count: 1,
				});

				// When
				await job.handleTodoReminder();

				// Then - 새로운 할일(201)에만 알림 발송
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batchCallArg = getFirstBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batchCallArg).toHaveLength(1);
				const firstNotification = getFirstNotification(batchCallArg);
				expect(firstNotification.todoId).toBe(201);
			});
		});

		describe("알림 대상 없음", () => {
			it("마감 임박 할일이 없으면 알림을 발송하지 않는다", async () => {
				// Given - 대상 할일 없음
				databaseService.todo.findMany.mockResolvedValue([] as never);

				// When - 할일 리마인더 job 실행
				await job.handleTodoReminder();

				// Then - 알림 발송이 호출되지 않음
				expect(databaseService.todo.findMany).toHaveBeenCalledTimes(1);
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
			});
		});

		describe("에러 처리", () => {
			it("데이터베이스 조회 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given - 데이터베이스 에러 발생
				const error = new Error("Database connection failed");
				databaseService.todo.findMany.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleTodoReminder()).resolves.not.toThrow();
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
			});

			it("알림 발송 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given - 할일은 있지만 알림 발송 실패
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 300, title: "Task", userId: "user-1" }),
				];
				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]);

				const error = new Error("Push notification failed");
				notificationService.createAndSendBatch.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleTodoReminder()).resolves.not.toThrow();
			});
		});

		describe("시간 범위 계산", () => {
			it("50분~60분 후 마감인 할일을 조회한다", async () => {
				// Given - 빈 결과 반환
				databaseService.todo.findMany.mockResolvedValue([] as never);

				// When - 할일 리마인더 job 실행
				await job.handleTodoReminder();

				// Then - 올바른 쿼리 조건으로 조회됨
				const findManyCall = getTodoFindManyCallArg(
					databaseService.todo.findMany as unknown as jest.Mock,
				);

				// where 조건 확인
				expect(findManyCall.where).toBeDefined();

				const scheduledTimeFilter = findManyCall.where?.scheduledTime;
				expect(scheduledTimeFilter).toBeDefined();
				expect(scheduledTimeFilter?.gte).toBeInstanceOf(Date);
				expect(scheduledTimeFilter?.lt).toBeInstanceOf(Date);
				expect(findManyCall.where?.completed).toBe(false);
				expect(findManyCall.where?.user).toEqual({ pushTokens: { some: {} } });

				// select 조건 확인
				expect(findManyCall.select).toBeDefined();
				expect(findManyCall.select?.id).toBe(true);
				expect(findManyCall.select?.title).toBe(true);
				expect(findManyCall.select?.userId).toBe(true);
			});
		});
	});
});

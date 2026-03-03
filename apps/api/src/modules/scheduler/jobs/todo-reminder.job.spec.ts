import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { ILockProvider } from "@/common/lock";
import { LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { REMINDER_STAGES } from "../constants/reminder.constants";
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
	let lockProvider: Mocked<ILockProvider>;

	/** per-todo Lock release mock 리스트 (검증용) */
	let perTodoReleaseMocks: jest.Mock[];

	beforeEach(async () => {
		perTodoReleaseMocks = [];

		const mockLockProvider: ILockProvider = {
			acquire: jest.fn(),
			isLocked: jest.fn(),
		};

		const { unit, unitRef } = await TestBed.solitary(TodoReminderJob)
			.mock(LOCK_PROVIDER)
			.impl(() => mockLockProvider)
			.compile();

		job = unit;
		databaseService = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
		lockProvider = unitRef.get(
			LOCK_PROVIDER,
		) as unknown as Mocked<ILockProvider>;

		// 기본: 모든 Lock 획득 성공
		lockProvider.acquire.mockImplementation(() => {
			const release = jest.fn();
			perTodoReleaseMocks.push(release);
			return Promise.resolve(release);
		});
	});

	/**
	 * DB 기반 중복 알림 조회 mock 설정 헬퍼 (배치 1차 필터용)
	 */
	const setupNotificationFindMany = (alreadyNotifiedTodoIds: number[] = []) => {
		Object.defineProperty(databaseService, "notification", {
			value: {
				findMany: jest
					.fn()
					.mockResolvedValue(
						alreadyNotifiedTodoIds.map((todoId) => ({ todoId })),
					),
				findFirst: jest.fn().mockResolvedValue(null), // per-todo Lock 내부 DB 재확인 (기본: 없음)
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
			it("마감 임박 할일에 대해 per-todo Lock 기반으로 알림을 발송한다", async () => {
				// Given - 마감 임박 할일 2개 준비
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: "Task 1", userId: "user-1" }),
					createMockTodoToNotify({ id: 2, title: "Task 2", userId: "user-2" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]); // 기존 알림 없음
				notificationService.createAndSend.mockResolvedValue({} as never);

				// When - 할일 리마인더 job 실행
				await job.handleTodoReminder();

				// Then - 각 stage × 각 todo에 대해 createAndSend 호출
				const stageCount = REMINDER_STAGES.length;
				expect(databaseService.todo.findMany).toHaveBeenCalledTimes(stageCount);
				// 2 todos × 2 stages = 4 createAndSend calls
				expect(notificationService.createAndSend).toHaveBeenCalledTimes(
					todos.length * stageCount,
				);

				// 첫 번째 호출 검증
				expect(notificationService.createAndSend).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "user-1",
						type: "TODO_REMINDER",
						todoId: 1,
					}),
				);
			});

			it("할일 제목이 포함된 알림을 생성한다", async () => {
				// Given - 특정 제목의 할일 준비
				const todoTitle = "중요한 회의 준비";
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: todoTitle, userId: "user-1" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]);
				notificationService.createAndSend.mockResolvedValue({} as never);

				// When - 할일 리마인더 job 실행
				await job.handleTodoReminder();

				// Then - todoId가 포함된 알림이 생성됨
				expect(notificationService.createAndSend).toHaveBeenCalledWith(
					expect.objectContaining({ todoId: 1 }),
				);
			});
		});

		describe("중복 알림 방지 (DB 기반 1차 필터)", () => {
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
				expect(notificationService.createAndSend).not.toHaveBeenCalled();
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
				notificationService.createAndSend.mockResolvedValue({} as never);

				// When
				await job.handleTodoReminder();

				// Then - 각 stage에서 새로운 할일(201)에만 알림 발송
				const stageCount = REMINDER_STAGES.length;
				expect(notificationService.createAndSend).toHaveBeenCalledTimes(
					stageCount,
				);
				expect(notificationService.createAndSend).toHaveBeenCalledWith(
					expect.objectContaining({ todoId: 201 }),
				);
			});
		});

		describe("중복 알림 방지 (per-todo Lock + DB 재확인)", () => {
			it("per-todo Lock 획득 실패 시 해당 알림을 스킵한다", async () => {
				// Given - 할일 1개, 전역 Lock은 성공하지만 per-todo Lock은 실패
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: "Task", userId: "user-1" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]);

				// 전역 Lock은 성공, per-todo Lock만 실패하도록 설정
				lockProvider.acquire.mockImplementation((key: string) => {
					if (key === "todo-reminder") {
						return Promise.resolve(jest.fn());
					}
					// per-todo Lock 실패
					return Promise.resolve(null);
				});

				// When
				await job.handleTodoReminder();

				// Then - createAndSend가 호출되지 않음
				expect(notificationService.createAndSend).not.toHaveBeenCalled();
			});

			it("Lock 내부 DB 재확인에서 이미 발송된 알림이면 스킵한다", async () => {
				// Given - 1차 배치 필터는 통과하지만 Lock 내부 DB 재확인에서 이미 존재
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: "Task", userId: "user-1" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]); // 1차 필터: 통과
				// Lock 내부 DB 재확인: 이미 존재
				databaseService.notification.findFirst.mockResolvedValue({
					id: 999,
				} as never);

				// When
				await job.handleTodoReminder();

				// Then - createAndSend가 호출되지 않음
				expect(notificationService.createAndSend).not.toHaveBeenCalled();
			});

			it("per-todo Lock 키가 InMemoryScheduler와 동일한 형식이다", async () => {
				// Given
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 42, title: "Task", userId: "user-1" }),
				];

				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]);
				notificationService.createAndSend.mockResolvedValue({} as never);

				// When
				await job.handleTodoReminder();

				// Then - Lock 키가 `reminder:{todoId}:{stageLabel}` 형식
				const acquireCalls = lockProvider.acquire.mock.calls;
				const perTodoCalls = acquireCalls.filter(
					(call) => call[0] !== "todo-reminder",
				);

				expect(perTodoCalls.length).toBeGreaterThan(0);
				for (const call of perTodoCalls) {
					expect(call[0]).toMatch(/^reminder:\d+:\w+$/);
					expect(call[1]).toBe(TodoReminderJob.DEDUP_LOCK_TTL);
				}
			});
		});

		describe("알림 대상 없음", () => {
			it("마감 임박 할일이 없으면 알림을 발송하지 않는다", async () => {
				// Given - 대상 할일 없음
				databaseService.todo.findMany.mockResolvedValue([] as never);

				// When - 할일 리마인더 job 실행
				await job.handleTodoReminder();

				// Then - 각 stage에서 조회하지만 대상 없어 알림 미발송
				expect(databaseService.todo.findMany).toHaveBeenCalledTimes(
					REMINDER_STAGES.length,
				);
				expect(notificationService.createAndSend).not.toHaveBeenCalled();
			});
		});

		describe("에러 처리", () => {
			it("데이터베이스 조회 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given - 데이터베이스 에러 발생
				const error = new Error("Database connection failed");
				databaseService.todo.findMany.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleTodoReminder()).resolves.not.toThrow();
				expect(notificationService.createAndSend).not.toHaveBeenCalled();
			});

			it("알림 발송 실패 시 에러를 로깅하고 종료한다", async () => {
				// Given - 할일은 있지만 알림 발송 실패
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 300, title: "Task", userId: "user-1" }),
				];
				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]);

				const error = new Error("Push notification failed");
				notificationService.createAndSend.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleTodoReminder()).resolves.not.toThrow();
			});

			it("per-todo 발송 실패 후에도 Lock이 해제된다", async () => {
				// Given
				const todos: TodoToNotify[] = [
					createMockTodoToNotify({ id: 1, title: "Task", userId: "user-1" }),
				];
				databaseService.todo.findMany.mockResolvedValue(todos as never);
				setupNotificationFindMany([]);
				notificationService.createAndSend.mockRejectedValue(
					new Error("Send failed"),
				);

				// When
				await job.handleTodoReminder();

				// Then - per-todo Lock의 release가 호출됨
				// perTodoReleaseMocks에는 전역 Lock release + per-todo Lock release가 포함
				const perTodoReleases = perTodoReleaseMocks.slice(1); // 첫 번째는 전역 Lock
				for (const release of perTodoReleases) {
					expect(release).toHaveBeenCalled();
				}
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

		describe("전역 Lock 기반 겹침 방지", () => {
			it("전역 Lock 획득 실패 시 작업을 스킵한다", async () => {
				// Given
				lockProvider.acquire.mockResolvedValue(null);

				// When
				await job.handleTodoReminder();

				// Then - database should NOT be called (no work done)
				expect(databaseService.todo.findMany).not.toHaveBeenCalled();
			});

			it("작업 완료 후 전역 Lock이 해제된다", async () => {
				// Given
				const mockRelease = jest.fn();
				lockProvider.acquire.mockResolvedValue(mockRelease);
				databaseService.todo.findMany.mockResolvedValue([] as never);

				// When
				await job.handleTodoReminder();

				// Then
				expect(mockRelease).toHaveBeenCalled();
			});

			it("작업 실패 시에도 전역 Lock이 해제된다", async () => {
				// Given
				const mockRelease = jest.fn();
				lockProvider.acquire.mockResolvedValue(mockRelease);
				databaseService.todo.findMany.mockRejectedValue(new Error("DB error"));

				// When
				await job.handleTodoReminder();

				// Then
				expect(mockRelease).toHaveBeenCalled();
			});
		});
	});
});

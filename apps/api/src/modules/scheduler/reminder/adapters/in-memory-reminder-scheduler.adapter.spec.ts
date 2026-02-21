import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../../notification/notification.service";
import { REMINDER_LEAD_TIME_MS } from "../../constants/reminder.constants";
import { InMemoryReminderSchedulerAdapter } from "./in-memory-reminder-scheduler.adapter";

// =============================================================================
// Constants
// =============================================================================

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";

// =============================================================================
// Tests
// =============================================================================

describe("InMemoryReminderSchedulerAdapter", () => {
	let service: InMemoryReminderSchedulerAdapter;
	let databaseService: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		jest.useFakeTimers();

		const { unit, unitRef } = await TestBed.solitary(
			InMemoryReminderSchedulerAdapter,
		).compile();

		service = unit;
		databaseService = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
	});

	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
	});

	/**
	 * notification.findFirst mock 설정 헬퍼
	 */
	const setupNotificationFindFirst = (exists: boolean) => {
		Object.defineProperty(databaseService, "notification", {
			value: {
				findFirst: jest.fn().mockResolvedValue(exists ? { id: 1 } : null),
				findMany: jest.fn().mockResolvedValue([]),
			},
			configurable: true,
			writable: true,
		});
	};

	/**
	 * todo.findMany mock 설정 헬퍼
	 */
	const setupTodoFindMany = (
		todos: Array<{
			id: number;
			title: string;
			userId: string;
			scheduledTime: Date;
		}>,
	) => {
		Object.defineProperty(databaseService, "todo", {
			value: {
				findMany: jest.fn().mockResolvedValue(todos),
			},
			configurable: true,
			writable: true,
		});
	};

	// =========================================================================
	// scheduleReminder
	// =========================================================================

	describe("scheduleReminder", () => {
		it("미래 scheduledTime에 대해 타이머를 등록하고, delay 후 알림을 발송한다", async () => {
			// Given - 2시간 후 마감인 투두 (리마인더는 1시간 후에 발송)
			const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
			setupNotificationFindFirst(false);
			notificationService.createAndSend.mockResolvedValue({} as never);

			// When - 리마인더 스케줄링
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// Then - 아직 알림 발송 안 됨
			expect(notificationService.createAndSend).not.toHaveBeenCalled();

			// When - LEAD_TIME 전까지 시간 경과 (1시간 후)
			jest.advanceTimersByTime(
				scheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now(),
			);

			// 비동기 콜백 실행 대기
			await jest.advanceTimersByTimeAsync(0);

			// Then - 알림이 발송됨
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: USER_ID,
					type: "TODO_REMINDER",
					todoId: 1,
				}),
			);
		});

		it("이미 지난 리마인더 시각이면 타이머를 등록하지 않는다", () => {
			// Given - 30분 후 마감 (리마인더 시각 = 30분 전 → 이미 지남)
			const scheduledTime = new Date(Date.now() + 30 * 60 * 1000);

			// When
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// Then - 아무 타이머도 등록되지 않음
			jest.advanceTimersByTime(60 * 60 * 1000);
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("같은 todoId로 재호출하면 기존 타이머를 취소하고 새로 등록한다", async () => {
			// Given - 첫 번째 스케줄링 (2시간 후 마감)
			const firstScheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
			service.scheduleReminder(1, firstScheduledTime, USER_ID, "Old Title");

			// When - 같은 todoId로 다른 시간에 재스케줄링 (3시간 후 마감)
			const secondScheduledTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
			setupNotificationFindFirst(false);
			notificationService.createAndSend.mockResolvedValue({} as never);

			service.scheduleReminder(1, secondScheduledTime, USER_ID, "New Title");

			// 첫 번째 타이머 시각 경과 (2시간 - 1시간 = 1시간 후)
			jest.advanceTimersByTime(
				firstScheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now(),
			);
			await jest.advanceTimersByTimeAsync(0);

			// Then - 첫 번째 타이머는 취소되어 호출 안 됨
			expect(notificationService.createAndSend).not.toHaveBeenCalled();

			// When - 두 번째 타이머 시각 경과 (3시간 - 1시간 = 2시간 후)
			jest.advanceTimersByTime(
				secondScheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now(),
			);
			await jest.advanceTimersByTimeAsync(0);

			// Then - 두 번째 타이머만 실행됨
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// cancelReminder
	// =========================================================================

	describe("cancelReminder", () => {
		it("등록된 타이머를 취소한다", async () => {
			// Given - 리마인더 등록
			const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// When - 취소
			service.cancelReminder(1);

			// Then - 타이머 시각 경과해도 알림 발송 안 됨
			jest.advanceTimersByTime(2 * 60 * 60 * 1000);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("미등록 todoId에 대해 에러 없이 무시한다", () => {
			// When & Then - 에러 발생하지 않음
			expect(() => service.cancelReminder(999)).not.toThrow();
		});
	});

	// =========================================================================
	// sendReminder (private — scheduleReminder 타이머 실행 시 간접 테스트)
	// =========================================================================

	describe("sendReminder (간접 테스트)", () => {
		it("24시간 내 동일 todoId TODO_REMINDER가 DB에 있으면 알림을 스킵한다", async () => {
			// Given - DB에 이미 알림 존재
			const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
			setupNotificationFindFirst(true);
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// When - 타이머 실행
			const delay =
				scheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now();
			jest.advanceTimersByTime(delay);
			await jest.advanceTimersByTimeAsync(0);

			// Then - 중복으로 스킵
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("DB에 중복이 없으면 정상적으로 알림을 발송한다", async () => {
			// Given - DB에 기존 알림 없음
			const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
			setupNotificationFindFirst(false);
			notificationService.createAndSend.mockResolvedValue({} as never);
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// When - 타이머 실행
			const delay =
				scheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now();
			jest.advanceTimersByTime(delay);
			await jest.advanceTimersByTimeAsync(0);

			// Then - 알림 발송됨
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: USER_ID,
					type: "TODO_REMINDER",
					title: expect.stringContaining(TODO_TITLE),
					body: expect.any(String),
					todoId: 1,
				}),
			);
		});

		it("알림 발송 중 에러가 발생해도 다른 타이머에 영향을 주지 않는다", async () => {
			// Given - 발송 실패하는 투두 + 성공하는 투두
			const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
			setupNotificationFindFirst(false);

			// 첫 호출은 실패, 두 번째는 성공
			notificationService.createAndSend
				.mockRejectedValueOnce(new Error("Push failed"))
				.mockResolvedValueOnce({} as never);

			service.scheduleReminder(1, scheduledTime, USER_ID, "Todo 1");
			service.scheduleReminder(2, scheduledTime, USER_ID, "Todo 2");

			// When - 타이머 실행
			const delay =
				scheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now();
			jest.advanceTimersByTime(delay);
			await jest.advanceTimersByTimeAsync(0);

			// Then - 두 번 모두 호출됨 (첫 번째 실패가 두 번째에 영향 없음)
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(2);
		});
	});

	// =========================================================================
	// onModuleDestroy
	// =========================================================================

	describe("onModuleDestroy", () => {
		it("모든 타이머를 정리한다", async () => {
			// Given - 여러 타이머 등록
			const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
			service.scheduleReminder(1, scheduledTime, USER_ID, "Todo 1");
			service.scheduleReminder(2, scheduledTime, USER_ID, "Todo 2");
			service.scheduleReminder(3, scheduledTime, USER_ID, "Todo 3");

			// When - 모듈 종료
			service.onModuleDestroy();

			// Then - 타이머 경과해도 알림 발송 안 됨
			jest.advanceTimersByTime(2 * 60 * 60 * 1000);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// onModuleInit (recoverPendingReminders)
	// =========================================================================

	describe("onModuleInit", () => {
		it("서버 재시작 시 미래 리마인더를 DB에서 복구한다", async () => {
			// Given - 미래 scheduledTime을 가진 투두 + 기존 알림 없음
			const futureScheduledTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
			setupTodoFindMany([
				{
					id: 10,
					title: "Recover Todo",
					userId: USER_ID,
					scheduledTime: futureScheduledTime,
				},
			]);

			Object.defineProperty(databaseService, "notification", {
				value: {
					findFirst: jest.fn().mockResolvedValue(null),
					findMany: jest.fn().mockResolvedValue([]),
				},
				configurable: true,
				writable: true,
			});

			notificationService.createAndSend.mockResolvedValue({} as never);

			// When - 모듈 초기화
			await service.onModuleInit();

			// Then - 타이머가 등록되어 적절한 시간에 발송됨
			const delay =
				futureScheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now();
			jest.advanceTimersByTime(delay);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					todoId: 10,
					userId: USER_ID,
					type: "TODO_REMINDER",
				}),
			);
		});

		it("이미 알림된 투두는 복구하지 않는다", async () => {
			// Given - 투두는 있지만 이미 알림 발송됨
			const futureScheduledTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
			setupTodoFindMany([
				{
					id: 20,
					title: "Already Notified",
					userId: USER_ID,
					scheduledTime: futureScheduledTime,
				},
			]);

			Object.defineProperty(databaseService, "notification", {
				value: {
					findFirst: jest.fn(),
					findMany: jest.fn().mockResolvedValue([{ todoId: 20 }]),
				},
				configurable: true,
				writable: true,
			});

			// When - 모듈 초기화
			await service.onModuleInit();

			// Then - 타이머 경과해도 알림 발송 안 됨
			jest.advanceTimersByTime(3 * 60 * 60 * 1000);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("LEAD_TIME 이내의 미래 할일도 복구한다", async () => {
			// Given - scheduledTime이 now+90분 (LEAD_TIME=60분 이내, 리마인더 시각=now+30분)
			const scheduledTime = new Date(Date.now() + 90 * 60 * 1000);
			setupTodoFindMany([
				{
					id: 30,
					title: "Near Future Todo",
					userId: USER_ID,
					scheduledTime,
				},
			]);

			Object.defineProperty(databaseService, "notification", {
				value: {
					findFirst: jest.fn().mockResolvedValue(null),
					findMany: jest.fn().mockResolvedValue([]),
				},
				configurable: true,
				writable: true,
			});

			notificationService.createAndSend.mockResolvedValue({} as never);

			// When - 모듈 초기화
			await service.onModuleInit();

			// Then - LEAD_TIME 이내여도 타이머가 등록되어 발송됨
			const delay =
				scheduledTime.getTime() - REMINDER_LEAD_TIME_MS - Date.now();
			jest.advanceTimersByTime(delay);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					todoId: 30,
					userId: USER_ID,
					type: "TODO_REMINDER",
				}),
			);
		});

		it("복구할 투두가 없으면 아무것도 하지 않는다", async () => {
			// Given - 대상 투두 없음
			setupTodoFindMany([]);

			// When
			await service.onModuleInit();

			// Then
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("복구 중 에러가 발생해도 서비스 초기화에 영향을 주지 않는다", async () => {
			// Given - DB 에러 발생
			Object.defineProperty(databaseService, "todo", {
				value: {
					findMany: jest
						.fn()
						.mockRejectedValue(new Error("DB connection failed")),
				},
				configurable: true,
				writable: true,
			});

			// When & Then - 에러가 throw되지 않음
			await expect(service.onModuleInit()).resolves.not.toThrow();
		});
	});
});

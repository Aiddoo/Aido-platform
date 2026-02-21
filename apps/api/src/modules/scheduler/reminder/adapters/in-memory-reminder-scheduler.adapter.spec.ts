import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../../notification/notification.service";
import { REMINDER_IMMEDIATE_LABEL } from "../../constants/reminder.constants";
import { InMemoryReminderSchedulerAdapter } from "./in-memory-reminder-scheduler.adapter";

// =============================================================================
// Constants
// =============================================================================

const USER_ID = "user-1";
const TODO_TITLE = "Test Todo";
const SIXTY_MIN_MS = 60 * 60 * 1000;

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
	 * notification mock 설정 헬퍼
	 */
	const setupNotificationMock = (findFirstResult: unknown = null) => {
		Object.defineProperty(databaseService, "notification", {
			value: {
				findFirst: jest.fn().mockResolvedValue(findFirstResult),
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
	// scheduleReminder — 다단계 스케줄링
	// =========================================================================

	describe("scheduleReminder", () => {
		it("2시간+ 후 마감이면 60분, 10분 두 단계 타이머를 등록한다", async () => {
			// Given — 2시간 후 마감
			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);
			setupNotificationMock(null);
			notificationService.createAndSend.mockResolvedValue({} as never);

			// When
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// Then — 60분 전 단계 (1시간 후)
			jest.advanceTimersByTime(SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { stage: "60min" },
					todoId: 1,
				}),
			);

			// Then — 10분 전 단계 (추가 50분 후)
			jest.advanceTimersByTime(50 * 60 * 1000);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).toHaveBeenCalledTimes(2);
			expect(notificationService.createAndSend).toHaveBeenLastCalledWith(
				expect.objectContaining({
					metadata: { stage: "10min" },
					todoId: 1,
				}),
			);
		});

		it("30분 후 마감이면 60분 단계는 스킵하고 10분 단계만 등록한다", async () => {
			// Given — 30분 후 마감 (60분 전 = -30분, 이미 지남)
			const scheduledTime = new Date(Date.now() + 30 * 60 * 1000);
			setupNotificationMock(null);
			notificationService.createAndSend.mockResolvedValue({} as never);

			// When
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// Then — 10분 전 단계 (20분 후)
			jest.advanceTimersByTime(20 * 60 * 1000);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { stage: "10min" },
				}),
			);
		});

		it("5분 후 마감이면 모든 단계가 지나서 즉시 발송한다", async () => {
			// Given — 5분 후 마감 (60분 전, 10분 전 모두 이미 지남)
			const scheduledTime = new Date(Date.now() + 5 * 60 * 1000);
			setupNotificationMock(null);
			notificationService.createAndSend.mockResolvedValue({} as never);

			// When
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// Then — 즉시 발송 (setTimeout 없이 바로 호출)
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { stage: REMINDER_IMMEDIATE_LABEL },
					todoId: 1,
				}),
			);
		});

		it("scheduledTime이 과거면 아무것도 하지 않는다", () => {
			// Given — 과거 시간
			const scheduledTime = new Date(Date.now() - 60 * 1000);

			// When
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// Then
			jest.advanceTimersByTime(SIXTY_MIN_MS);
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("같은 todoId로 재호출하면 기존 모든 단계를 취소하고 새로 등록한다", async () => {
			// Given — 첫 스케줄링 (2시간 후 마감)
			const firstTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);
			service.scheduleReminder(1, firstTime, USER_ID, "Old");

			// When — 재스케줄링 (3시간 후 마감)
			const secondTime = new Date(Date.now() + 3 * SIXTY_MIN_MS);
			setupNotificationMock(null);
			notificationService.createAndSend.mockResolvedValue({} as never);
			service.scheduleReminder(1, secondTime, USER_ID, "New");

			// 첫 번째 60분 단계 시각 경과
			jest.advanceTimersByTime(SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);

			// Then — 첫 번째 타이머는 취소됨
			expect(notificationService.createAndSend).not.toHaveBeenCalled();

			// 두 번째 60분 단계 시각 경과 (2시간 후)
			jest.advanceTimersByTime(SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);

			// Then — 두 번째 타이머만 실행됨
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { stage: "60min" },
				}),
			);
		});
	});

	// =========================================================================
	// cancelReminder
	// =========================================================================

	describe("cancelReminder", () => {
		it("등록된 모든 단계 타이머를 취소한다", async () => {
			// Given
			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// When
			service.cancelReminder(1);

			// Then
			jest.advanceTimersByTime(2 * SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("미등록 todoId에 대해 에러 없이 무시한다", () => {
			expect(() => service.cancelReminder(999)).not.toThrow();
		});
	});

	// =========================================================================
	// sendReminder — 단계별 중복 방지
	// =========================================================================

	describe("sendReminder (간접 테스트)", () => {
		it("같은 stage의 알림이 DB에 있으면 스킵한다", async () => {
			// Given — DB에 같은 stage 알림 존재
			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);
			setupNotificationMock({ id: 1 });
			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// When — 60분 전 단계 실행
			jest.advanceTimersByTime(SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);

			// Then — 스킵
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("다른 stage의 알림이 DB에 있어도 정상 발송한다", async () => {
			// Given — DB에 "60min" stage 알림은 있지만 "10min"은 없음
			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);
			const findFirstFn = jest
				.fn()
				// 60min 단계 호출: 이미 존재 → 스킵
				.mockResolvedValueOnce({ id: 1 })
				// 10min 단계 호출: 없음 → 발송
				.mockResolvedValueOnce(null);

			Object.defineProperty(databaseService, "notification", {
				value: {
					findFirst: findFirstFn,
					findMany: jest.fn().mockResolvedValue([]),
				},
				configurable: true,
				writable: true,
			});
			notificationService.createAndSend.mockResolvedValue({} as never);

			service.scheduleReminder(1, scheduledTime, USER_ID, TODO_TITLE);

			// 60분 단계 실행 → 스킵됨
			jest.advanceTimersByTime(SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);
			expect(notificationService.createAndSend).not.toHaveBeenCalled();

			// 10분 단계 실행 → 발송됨
			jest.advanceTimersByTime(50 * 60 * 1000);
			await jest.advanceTimersByTimeAsync(0);
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: { stage: "10min" },
				}),
			);
		});

		it("알림 발송 중 에러가 발생해도 다른 타이머에 영향을 주지 않는다", async () => {
			// Given
			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);
			setupNotificationMock(null);

			notificationService.createAndSend
				.mockRejectedValueOnce(new Error("Push failed"))
				.mockResolvedValueOnce({} as never);

			service.scheduleReminder(1, scheduledTime, USER_ID, "Todo 1");
			service.scheduleReminder(2, scheduledTime, USER_ID, "Todo 2");

			// When — 60분 전 단계 실행
			jest.advanceTimersByTime(SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);

			// Then — 두 투두 모두 호출됨
			expect(notificationService.createAndSend).toHaveBeenCalledTimes(2);
		});
	});

	// =========================================================================
	// onModuleDestroy
	// =========================================================================

	describe("onModuleDestroy", () => {
		it("모든 todoId의 모든 단계 타이머를 정리한다", async () => {
			// Given — 여러 투두, 각각 다단계 타이머
			const scheduledTime = new Date(Date.now() + 2 * SIXTY_MIN_MS);
			service.scheduleReminder(1, scheduledTime, USER_ID, "Todo 1");
			service.scheduleReminder(2, scheduledTime, USER_ID, "Todo 2");

			// When
			service.onModuleDestroy();

			// Then
			jest.advanceTimersByTime(2 * SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);
			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// onModuleInit (recoverPendingReminders — Gemini 쿼리 최적화)
	// =========================================================================

	describe("onModuleInit", () => {
		it("서버 재시작 시 미래 리마인더를 단일 쿼리로 복구한다", async () => {
			// Given
			const futureTime = new Date(Date.now() + 3 * SIXTY_MIN_MS);
			setupTodoFindMany([
				{
					id: 10,
					title: "Recover Todo",
					userId: USER_ID,
					scheduledTime: futureTime,
				},
			]);
			setupNotificationMock(null);
			notificationService.createAndSend.mockResolvedValue({} as never);

			// When
			await service.onModuleInit();

			// Then — 60분 전 단계 발송
			jest.advanceTimersByTime(2 * SIXTY_MIN_MS);
			await jest.advanceTimersByTimeAsync(0);

			expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSend).toHaveBeenCalledWith(
				expect.objectContaining({
					todoId: 10,
					userId: USER_ID,
					type: "TODO_REMINDER",
					metadata: { stage: "60min" },
				}),
			);
		});

		it("복구할 투두가 없으면 아무것도 하지 않는다", async () => {
			setupTodoFindMany([]);

			await service.onModuleInit();

			expect(notificationService.createAndSend).not.toHaveBeenCalled();
		});

		it("복구 중 에러가 발생해도 서비스 초기화에 영향을 주지 않는다", async () => {
			Object.defineProperty(databaseService, "todo", {
				value: {
					findMany: jest
						.fn()
						.mockRejectedValue(new Error("DB connection failed")),
				},
				configurable: true,
				writable: true,
			});

			await expect(service.onModuleInit()).resolves.not.toThrow();
		});
	});
});

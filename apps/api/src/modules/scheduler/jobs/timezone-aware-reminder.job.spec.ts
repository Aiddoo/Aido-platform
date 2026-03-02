import { Logger } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import type { ILockProvider } from "@/common/lock";
import { LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { TimezoneAwareReminderJob } from "./timezone-aware-reminder.job";

// =============================================================================
// Mock Factory Functions
// =============================================================================

interface MockTimezoneRecord {
	timezone: string;
}

function createMockTimezoneRecord(tz: string): MockTimezoneRecord {
	return { timezone: tz };
}

interface MockMorningUser {
	id: string;
	_count: { todos: number };
}

function createMockMorningUser(
	overrides: Partial<MockMorningUser> = {},
): MockMorningUser {
	return {
		id: overrides.id ?? "user-1",
		_count: overrides._count ?? { todos: 3 },
	};
}

interface MockEveningUser {
	id: string;
	todos: Array<{ completed: boolean }>;
}

function createMockEveningUser(
	overrides: Partial<MockEveningUser> = {},
): MockEveningUser {
	return {
		id: overrides.id ?? "user-1",
		todos: overrides.todos ?? [
			{ completed: true },
			{ completed: false },
			{ completed: false },
		],
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
	notificationDate?: Date;
}

/**
 * mock.calls에서 특정 호출의 첫 번째 인자를 타입 안전하게 가져옴
 */
function getBatchCallArg(
	mock: jest.Mock,
	callIndex = 0,
): NotificationBatchItem[] {
	const calls = mock.mock.calls;
	if (calls.length <= callIndex) {
		throw new Error(
			`Expected mock to have been called at least ${callIndex + 1} time(s), but was called ${calls.length} time(s)`,
		);
	}
	const call = calls[callIndex];
	if (!call || call.length === 0) {
		throw new Error("Expected call to have arguments");
	}
	return call[0] as NotificationBatchItem[];
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

// =============================================================================
// Tests
// =============================================================================

describe("TimezoneAwareReminderJob", () => {
	let job: TimezoneAwareReminderJob;
	let databaseService: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;
	let lockProvider: Mocked<ILockProvider>;

	beforeEach(async () => {
		const mockLockProvider: ILockProvider = {
			acquire: jest.fn(),
			isLocked: jest.fn(),
		};

		const { unit, unitRef } = await TestBed.solitary(TimezoneAwareReminderJob)
			.mock(LOCK_PROVIDER)
			.impl(() => mockLockProvider)
			.compile();

		job = unit;
		databaseService = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);
		lockProvider = unitRef.get(LOCK_PROVIDER);

		// 기본: Lock 획득 성공 (release 함수 반환)
		lockProvider.acquire.mockResolvedValue(jest.fn());
		// 기본: 중복 알림 없음
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
	});

	// =========================================================================
	// handleHourlySweep
	// =========================================================================

	describe("handleHourlySweep", () => {
		// =====================================================================
		// 아침 리마인더
		// =====================================================================

		describe("아침 리마인더", () => {
			it("Asia/Seoul 사용자가 morningReminderHour=8이고 현재 KST 08:00일 때 아침 리마인더 발송", async () => {
				// Given - KST 08:00 = UTC 2024-01-15T23:00:00Z (전날)
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				const expectedLocalHour = dayjs(fakeNow).tz("Asia/Seoul").hour(); // 8

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockMorningUser({
					id: "user-seoul",
					_count: { todos: 3 },
				});

				// user.findMany: 아침 리마인더 대상 → 저녁 리마인더 대상 순으로 호출
				databaseService.user.findMany
					.mockResolvedValueOnce([mockUser] as never) // 아침 리마인더
					.mockResolvedValueOnce([] as never); // 저녁 리마인더

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When - hourly sweep 실행
				await job.handleHourlySweep();

				// Then - 아침 리마인더가 발송됨
				expect(databaseService.user.findMany).toHaveBeenCalledTimes(2);

				// 아침 리마인더 user.findMany 호출 확인
				const morningCall = databaseService.user.findMany.mock
					.calls[0]?.[0] as {
					where?: {
						preference?: {
							morningReminderHour?: number;
							morningReminderMinute?: { gte: number; lt: number };
						};
					};
				};
				expect(morningCall?.where?.preference?.morningReminderHour).toBe(
					expectedLocalHour,
				);
				expect(morningCall?.where?.preference?.morningReminderMinute).toEqual({
					gte: 0,
					lt: 30,
				});

				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batch).toHaveLength(1);

				const notification = getFirstNotification(batch);
				expect(notification.userId).toBe("user-seoul");
				expect(notification.type).toBe("MORNING_REMINDER");
				expect(notification.notificationDate).toEqual(
					dayjs.utc("2024-01-16").startOf("day").toDate(),
				);

				jest.useRealTimers();
			});

			it("Asia/Seoul 사용자가 morningReminderMinute=30이고 현재 KST 08:30일 때 아침 리마인더 발송", async () => {
				// Given - KST 08:30 = UTC 2024-01-15T23:30:00Z
				const fakeNow = new Date("2024-01-15T23:30:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockMorningUser({
					id: "user-seoul-30",
					_count: { todos: 2 },
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([mockUser] as never)
					.mockResolvedValueOnce([] as never);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - morningReminderMinute 범위 쿼리 (30분 버킷)
				const morningCall = databaseService.user.findMany.mock
					.calls[0]?.[0] as {
					where?: {
						preference?: {
							morningReminderHour?: number;
							morningReminderMinute?: { gte: number; lt: number };
						};
					};
				};
				expect(morningCall?.where?.preference?.morningReminderHour).toBe(8);
				expect(morningCall?.where?.preference?.morningReminderMinute).toEqual({
					gte: 30,
					lt: 60,
				});

				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

				jest.useRealTimers();
			});

			it("할일이 있는 사용자에게 morningReminder(count) 메시지 발송", async () => {
				// Given - KST 08:00
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockMorningUser({
					id: "user-1",
					_count: { todos: 5 },
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([mockUser] as never)
					.mockResolvedValueOnce([] as never);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - morningReminder(5) 메시지가 사용됨
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const notification = getFirstNotification(batch);
				const expectedMessage = NotificationMessageBuilder.morningReminder(5);
				expect(notification.title).toBe(expectedMessage.title);
				expect(notification.body).toBe(expectedMessage.body);

				jest.useRealTimers();
			});

			it("할일이 없는 사용자에게 morningNoTodo 메시지 발송", async () => {
				// Given - KST 08:00
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockMorningUser({
					id: "user-1",
					_count: { todos: 0 },
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([mockUser] as never)
					.mockResolvedValueOnce([] as never);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - morningNoTodo 메시지가 사용됨
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const notification = getFirstNotification(batch);
				const expectedMessage = NotificationMessageBuilder.morningNoTodo();
				expect(notification.title).toBe(expectedMessage.title);
				expect(notification.body).toBe(expectedMessage.body);

				jest.useRealTimers();
			});
		});

		// =====================================================================
		// 저녁 리마인더
		// =====================================================================

		describe("저녁 리마인더", () => {
			it("eveningReminderHour=18인 사용자에게 저녁 리마인더 발송", async () => {
				// Given - KST 18:00 = UTC 09:00
				const fakeNow = new Date("2024-01-15T09:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockEveningUser({
					id: "user-evening",
					todos: [
						{ completed: true },
						{ completed: true },
						{ completed: false },
					],
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([] as never) // 아침 리마인더 (매칭 안 됨)
					.mockResolvedValueOnce([mockUser] as never); // 저녁 리마인더

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - 저녁 리마인더가 발송됨
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batch).toHaveLength(1);

				const notification = getFirstNotification(batch);
				expect(notification.userId).toBe("user-evening");
				expect(notification.type).toBe("EVENING_REMINDER");
				expect(notification.notificationDate).toEqual(
					dayjs.utc("2024-01-15").startOf("day").toDate(),
				);

				jest.useRealTimers();
			});

			it("eveningReminderMinute=30인 사용자에게 저녁 리마인더 발송 (KST 18:30)", async () => {
				// Given - KST 18:30 = UTC 09:30
				const fakeNow = new Date("2024-01-15T09:30:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockEveningUser({
					id: "user-evening-30",
					todos: [{ completed: true }, { completed: false }],
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([] as never)
					.mockResolvedValueOnce([mockUser] as never);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - eveningReminderMinute 범위 쿼리 (30분 버킷)
				const eveningCall = databaseService.user.findMany.mock
					.calls[1]?.[0] as {
					where?: {
						preference?: {
							eveningReminderHour?: number;
							eveningReminderMinute?: { gte: number; lt: number };
						};
					};
				};
				expect(eveningCall?.where?.preference?.eveningReminderHour).toBe(18);
				expect(eveningCall?.where?.preference?.eveningReminderMinute).toEqual({
					gte: 30,
					lt: 60,
				});

				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(getFirstNotification(batch).userId).toBe("user-evening-30");
				expect(getFirstNotification(batch).type).toBe("EVENING_REMINDER");

				jest.useRealTimers();
			});

			it("완료/전체 개수 기반 메시지 분기 - 전부 완료", async () => {
				// Given - KST 21:00 = UTC 12:00
				const fakeNow = new Date("2024-01-15T12:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockEveningUser({
					id: "user-1",
					todos: [{ completed: true }, { completed: true }],
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([] as never) // 아침
					.mockResolvedValueOnce([mockUser] as never); // 저녁

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - 전부 완료 메시지
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const notification = getFirstNotification(batch);
				const expectedMessage = NotificationMessageBuilder.eveningReminder(
					2,
					2,
				);
				expect(notification.title).toBe(expectedMessage.title);
				expect(notification.body).toBe(expectedMessage.body);

				jest.useRealTimers();
			});

			it("완료/전체 개수 기반 메시지 분기 - 하나도 안 함", async () => {
				// Given - KST 21:00 = UTC 12:00
				const fakeNow = new Date("2024-01-15T12:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockEveningUser({
					id: "user-1",
					todos: [{ completed: false }, { completed: false }],
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([] as never)
					.mockResolvedValueOnce([mockUser] as never);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - 하나도 안 함 메시지
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const notification = getFirstNotification(batch);
				const expectedMessage = NotificationMessageBuilder.eveningReminder(
					0,
					2,
				);
				expect(notification.title).toBe(expectedMessage.title);
				expect(notification.body).toBe(expectedMessage.body);

				jest.useRealTimers();
			});

			it("완료/전체 개수 기반 메시지 분기 - 일부 완료", async () => {
				// Given - KST 18:00 = UTC 09:00
				const fakeNow = new Date("2024-01-15T09:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockEveningUser({
					id: "user-1",
					todos: [
						{ completed: true },
						{ completed: false },
						{ completed: false },
					],
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([] as never)
					.mockResolvedValueOnce([mockUser] as never);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - 일부 완료 메시지 (completed=1, total=3)
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const notification = getFirstNotification(batch);
				const expectedMessage = NotificationMessageBuilder.eveningReminder(
					1,
					3,
				);
				expect(notification.title).toBe(expectedMessage.title);
				expect(notification.body).toBe(expectedMessage.body);

				jest.useRealTimers();
			});
		});

		// =====================================================================
		// 다중 타임존
		// =====================================================================

		describe("다중 타임존", () => {
			it("다른 타임존의 사용자에게 각각 올바른 시간에 발송", async () => {
				// Given - UTC 00:00
				// Asia/Seoul: 09:00 (아침 리마인더 시간)
				// America/New_York: 19:00 (저녁 리마인더 시간)
				const fakeNow = new Date("2024-01-16T00:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
					createMockTimezoneRecord("America/New_York"),
				] as never);

				const seoulMorningUser = createMockMorningUser({
					id: "user-seoul",
					_count: { todos: 2 },
				});

				const nyEveningUser = createMockEveningUser({
					id: "user-ny",
					todos: [{ completed: true }],
				});

				// Asia/Seoul: 아침 매칭, 저녁 미매칭
				// America/New_York: 아침 미매칭, 저녁 매칭
				databaseService.user.findMany
					.mockResolvedValueOnce([seoulMorningUser] as never) // Seoul 아침
					.mockResolvedValueOnce([] as never) // Seoul 저녁
					.mockResolvedValueOnce([] as never) // NY 아침
					.mockResolvedValueOnce([nyEveningUser] as never); // NY 저녁

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - 두 번 호출됨 (서울 아침 + NY 저녁)
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(2);

				// 서울 아침 리마인더
				const seoulBatch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
					0,
				);
				expect(getFirstNotification(seoulBatch).userId).toBe("user-seoul");
				expect(getFirstNotification(seoulBatch).type).toBe("MORNING_REMINDER");

				// NY 저녁 리마인더
				const nyBatch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
					1,
				);
				expect(getFirstNotification(nyBatch).userId).toBe("user-ny");
				expect(getFirstNotification(nyBatch).type).toBe("EVENING_REMINDER");

				jest.useRealTimers();
			});

			it("매칭 안 되는 타임존/시간 조합은 스킵", async () => {
				// Given - UTC 05:00
				// Asia/Seoul: 14:00 (아침/저녁 모두 아님)
				// Europe/London: 05:00 (아침/저녁 모두 아님)
				const fakeNow = new Date("2024-01-15T05:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
					createMockTimezoneRecord("Europe/London"),
				] as never);

				// 모든 user.findMany 호출에서 빈 배열 반환
				databaseService.user.findMany.mockResolvedValue([] as never);

				// When
				await job.handleHourlySweep();

				// Then - 아무 알림도 발송되지 않음
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

				jest.useRealTimers();
			});
		});

		// =====================================================================
		// 구독 상태 필터링 (프리미엄 전용)
		// =====================================================================

		describe("구독 상태 필터링", () => {
			it("아침 리마인더 쿼리에 subscriptionStatus/role OR 조건이 포함된다", async () => {
				// Given - KST 08:00
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				databaseService.user.findMany.mockResolvedValue([] as never);

				// When
				await job.handleHourlySweep();

				// Then - 아침 리마인더 호출(첫 번째)에 OR 조건 확인
				const morningCall = databaseService.user.findMany.mock
					.calls[0]?.[0] as {
					where?: {
						OR?: Array<Record<string, string>>;
					};
				};
				expect(morningCall?.where?.OR).toEqual([
					{ subscriptionStatus: "ACTIVE" },
					{ role: "ADMIN" },
				]);

				jest.useRealTimers();
			});

			it("저녁 리마인더 쿼리에 subscriptionStatus/role OR 조건이 포함된다", async () => {
				// Given - KST 18:00
				const fakeNow = new Date("2024-01-15T09:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				databaseService.user.findMany.mockResolvedValue([] as never);

				// When
				await job.handleHourlySweep();

				// Then - 저녁 리마인더 호출(두 번째)에 OR 조건 확인
				const eveningCall = databaseService.user.findMany.mock
					.calls[1]?.[0] as {
					where?: {
						OR?: Array<Record<string, string>>;
					};
				};
				expect(eveningCall?.where?.OR).toEqual([
					{ subscriptionStatus: "ACTIVE" },
					{ role: "ADMIN" },
				]);

				jest.useRealTimers();
			});
		});

		// =====================================================================
		// 알림 대상 없음
		// =====================================================================

		describe("알림 대상 없음", () => {
			it("pushEnabled=false인 타임존만 있으면 조회 안 함", async () => {
				// Given - pushEnabled=true인 타임존이 없어 빈 배열 반환
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([] as never);

				// When
				await job.handleHourlySweep();

				// Then - user.findMany가 호출되지 않음
				expect(databaseService.user.findMany).not.toHaveBeenCalled();
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

				jest.useRealTimers();
			});

			it("대상 사용자가 없으면 createAndSendBatch 호출 안 함", async () => {
				// Given - 타임존은 있지만 매칭되는 사용자 없음
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				databaseService.user.findMany.mockResolvedValue([] as never);

				// When
				await job.handleHourlySweep();

				// Then - createAndSendBatch 호출 안 됨
				expect(databaseService.user.findMany).toHaveBeenCalledTimes(2); // 아침 + 저녁
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

				jest.useRealTimers();
			});
		});

		// =====================================================================
		// 에러 처리
		// =====================================================================

		describe("에러 처리", () => {
			it("DB 에러 시 throw하지 않고 로깅", async () => {
				// Given - 타임존 조회에서 DB 에러 발생
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				const error = new Error("Database connection failed");
				databaseService.userPreference.findMany.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleHourlySweep()).resolves.not.toThrow();
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

				jest.useRealTimers();
			});

			it("user.findMany 에러 시 throw하지 않고 로깅", async () => {
				// Given - 사용자 조회에서 에러 발생
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const error = new Error("Query failed");
				databaseService.user.findMany.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleHourlySweep()).resolves.not.toThrow();

				jest.useRealTimers();
			});

			it("createAndSendBatch 에러 시 throw하지 않고 로깅", async () => {
				// Given - 알림 발송에서 에러 발생
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockMorningUser({
					id: "user-1",
					_count: { todos: 3 },
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([mockUser] as never)
					.mockResolvedValueOnce([] as never);

				const error = new Error("Push notification failed");
				notificationService.createAndSendBatch.mockRejectedValue(error);

				// When & Then - 에러가 throw되지 않고 내부에서 처리됨
				await expect(job.handleHourlySweep()).resolves.not.toThrow();

				jest.useRealTimers();
			});

			it("한 타임존 실패 시 다른 타임존은 정상 처리된다", async () => {
				// Given - UTC 00:00
				// Asia/Seoul: 09:00 (아침), America/New_York: 19:00 (저녁)
				const fakeNow = new Date("2024-01-16T00:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
					createMockTimezoneRecord("America/New_York"),
				] as never);

				// Seoul: user.findMany에서 에러 발생 (아침 리마인더 쿼리)
				const dbError = new Error("Seoul query failed");

				const nyEveningUser = createMockEveningUser({
					id: "user-ny",
					todos: [{ completed: true }],
				});

				// Seoul 아침 → 에러, Seoul 저녁은 호출 안 됨 (아침에서 에러 전파)
				// NY 아침 → 빈 배열, NY 저녁 → 사용자 있음
				databaseService.user.findMany
					.mockRejectedValueOnce(dbError) // Seoul 아침 → 에러
					.mockResolvedValueOnce([] as never) // NY 아침
					.mockResolvedValueOnce([nyEveningUser] as never); // NY 저녁

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - NY 저녁 리마인더는 정상 발송
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(getFirstNotification(batch).userId).toBe("user-ny");
				expect(getFirstNotification(batch).type).toBe("EVENING_REMINDER");

				jest.useRealTimers();
			});

			it("타임존 실패 시 에러 로그에 타임존 정보가 포함된다", async () => {
				// Given - UTC 00:00, Asia/Seoul만 있고 에러 발생
				const fakeNow = new Date("2024-01-16T00:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				const loggerErrorSpy = jest.spyOn(Logger.prototype, "error");

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const dbError = new Error("Query failed");
				databaseService.user.findMany.mockRejectedValue(dbError);

				// When
				await job.handleHourlySweep();

				// Then - 에러 로그에 타임존 정보 포함
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					expect.stringContaining("Asia/Seoul"),
					expect.anything(),
				);

				loggerErrorSpy.mockRestore();
				jest.useRealTimers();
			});
		});

		// =====================================================================
		// 중복 방지
		// =====================================================================

		describe("중복 방지", () => {
			it("이미 아침 리마인더를 받은 사용자는 제외한다", async () => {
				// Given - KST 08:00, 2명의 사용자 중 1명은 이미 알림 받음
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const user1 = createMockMorningUser({
					id: "user-1",
					_count: { todos: 3 },
				});
				const user2 = createMockMorningUser({
					id: "user-2",
					_count: { todos: 5 },
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([user1, user2] as never) // 아침
					.mockResolvedValueOnce([] as never); // 저녁

				// user-1은 이미 아침 리마인더를 받음
				notificationService.findAlreadyNotifiedUserIds.mockResolvedValueOnce(
					new Set(["user-1"]),
				);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - user-2에게만 발송
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batch).toHaveLength(1);
				expect(getFirstNotification(batch).userId).toBe("user-2");

				jest.useRealTimers();
			});

			it("이미 저녁 리마인더를 받은 사용자는 제외한다", async () => {
				// Given - KST 18:00, 2명의 사용자 중 1명은 이미 알림 받음
				const fakeNow = new Date("2024-01-15T09:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const user1 = createMockEveningUser({
					id: "user-1",
					todos: [{ completed: true }],
				});
				const user2 = createMockEveningUser({
					id: "user-2",
					todos: [{ completed: false }],
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([] as never) // 아침
					.mockResolvedValueOnce([user1, user2] as never); // 저녁

				// user-1은 이미 저녁 리마인더를 받음
				notificationService.findAlreadyNotifiedUserIds.mockResolvedValueOnce(
					new Set(["user-1"]),
				);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - user-2에게만 발송
				expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				expect(batch).toHaveLength(1);
				expect(getFirstNotification(batch).userId).toBe("user-2");

				jest.useRealTimers();
			});

			it("모든 사용자가 이미 알림을 받았으면 발송하지 않는다", async () => {
				// Given - KST 08:00, 모든 사용자가 이미 알림 받음
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const user1 = createMockMorningUser({
					id: "user-1",
					_count: { todos: 3 },
				});
				const user2 = createMockMorningUser({
					id: "user-2",
					_count: { todos: 5 },
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([user1, user2] as never) // 아침
					.mockResolvedValueOnce([] as never); // 저녁

				// 모든 사용자가 이미 아침 리마인더를 받음
				notificationService.findAlreadyNotifiedUserIds.mockResolvedValueOnce(
					new Set(["user-1", "user-2"]),
				);

				// When
				await job.handleHourlySweep();

				// Then - createAndSendBatch 호출 안 됨
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

				jest.useRealTimers();
			});

			it("notificationDate가 배치 데이터에 포함된다", async () => {
				// Given - KST 08:00
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				const mockUser = createMockMorningUser({
					id: "user-1",
					_count: { todos: 3 },
				});

				databaseService.user.findMany
					.mockResolvedValueOnce([mockUser] as never)
					.mockResolvedValueOnce([] as never);

				notificationService.createAndSendBatch.mockResolvedValue({ count: 1 });

				// When
				await job.handleHourlySweep();

				// Then - notificationDate가 KST 기준 오늘 날짜 (2024-01-16)
				const batch = getBatchCallArg(
					notificationService.createAndSendBatch as unknown as jest.Mock,
				);
				const notification = getFirstNotification(batch);
				expect(notification.notificationDate).toEqual(
					dayjs.utc("2024-01-16").startOf("day").toDate(),
				);

				jest.useRealTimers();
			});
		});

		// =====================================================================
		// Lock 기반 겹침 방지
		// =====================================================================

		describe("Lock 기반 겹침 방지", () => {
			it("Lock 획득 실패 시 작업을 스킵한다", async () => {
				// Given - Lock 획득 실패 (다른 인스턴스가 이미 점유)
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				lockProvider.acquire.mockResolvedValue(null);

				// When
				await job.handleHourlySweep();

				// Then - DB 조회 자체가 실행되지 않음
				expect(databaseService.userPreference.findMany).not.toHaveBeenCalled();
				expect(databaseService.user.findMany).not.toHaveBeenCalled();
				expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

				jest.useRealTimers();
			});

			it("작업 완료 후 Lock이 해제된다", async () => {
				// Given - Lock 획득 성공
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				const mockRelease = jest.fn().mockResolvedValue(undefined);
				lockProvider.acquire.mockResolvedValue(mockRelease);

				databaseService.userPreference.findMany.mockResolvedValue([
					createMockTimezoneRecord("Asia/Seoul"),
				] as never);

				databaseService.user.findMany.mockResolvedValue([] as never);

				// When
				await job.handleHourlySweep();

				// Then - release 함수가 호출됨
				expect(mockRelease).toHaveBeenCalledTimes(1);

				jest.useRealTimers();
			});

			it("작업 실패 시에도 Lock이 해제된다", async () => {
				// Given - Lock 획득 성공, 하지만 DB 에러 발생
				const fakeNow = new Date("2024-01-15T23:00:00Z");
				jest.useFakeTimers();
				jest.setSystemTime(fakeNow);

				const mockRelease = jest.fn().mockResolvedValue(undefined);
				lockProvider.acquire.mockResolvedValue(mockRelease);

				const error = new Error("Database connection failed");
				databaseService.userPreference.findMany.mockRejectedValue(error);

				// When - 에러가 발생해도 정상 종료
				await expect(job.handleHourlySweep()).resolves.not.toThrow();

				// Then - release 함수가 반드시 호출됨 (finally 블록)
				expect(mockRelease).toHaveBeenCalledTimes(1);

				jest.useRealTimers();
			});
		});
	});

	// =========================================================================
	// handleReminderHourChanged (Catch-up 패턴)
	// =========================================================================

	describe("handleReminderHourChanged", () => {
		it("변경된 아침 리마인더 시간이 현재 버킷과 일치하면 즉시 발송", async () => {
			// Given - KST 08:15 = UTC 2024-01-15T23:15:00Z, 버킷 = :00
			const fakeNow = new Date("2024-01-15T23:15:00Z");
			jest.useFakeTimers();
			jest.setSystemTime(fakeNow);

			const mockUser = createMockMorningUser({
				id: "user-catchup",
				_count: { todos: 3 },
			});

			databaseService.user.findMany.mockResolvedValueOnce([mockUser] as never);

			notificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			// When - 아침 08:15로 변경 (현재 버킷 0~29에 포함)
			await job.handleReminderHourChanged({
				userId: "user-catchup",
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 15,
			});

			// Then - 즉시 아침 리마인더 발송
			expect(databaseService.user.findMany).toHaveBeenCalledTimes(1);
			expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

			const batch = getBatchCallArg(
				notificationService.createAndSendBatch as unknown as jest.Mock,
			);
			expect(getFirstNotification(batch).userId).toBe("user-catchup");
			expect(getFirstNotification(batch).type).toBe("MORNING_REMINDER");

			jest.useRealTimers();
		});

		it("변경된 저녁 리마인더 시간이 현재 버킷과 일치하면 즉시 발송", async () => {
			// Given - KST 18:45 = UTC 2024-01-15T09:45:00Z, 버킷 = :30
			const fakeNow = new Date("2024-01-15T09:45:00Z");
			jest.useFakeTimers();
			jest.setSystemTime(fakeNow);

			const mockUser = createMockEveningUser({
				id: "user-catchup-evening",
				todos: [{ completed: true }, { completed: false }],
			});

			databaseService.user.findMany.mockResolvedValueOnce([mockUser] as never);

			notificationService.createAndSendBatch.mockResolvedValue({
				count: 1,
			});

			// When - 저녁 18:45로 변경 (현재 버킷 30~59에 포함)
			await job.handleReminderHourChanged({
				userId: "user-catchup-evening",
				timezone: "Asia/Seoul",
				eveningReminderHour: 18,
				eveningReminderMinute: 45,
			});

			// Then - 즉시 저녁 리마인더 발송
			expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

			const batch = getBatchCallArg(
				notificationService.createAndSendBatch as unknown as jest.Mock,
			);
			expect(getFirstNotification(batch).type).toBe("EVENING_REMINDER");

			jest.useRealTimers();
		});

		it("변경된 시간이 현재 버킷과 불일치하면 발송하지 않음", async () => {
			// Given - KST 08:00 = UTC 2024-01-15T23:00:00Z, 버킷 = :00
			const fakeNow = new Date("2024-01-15T23:00:00Z");
			jest.useFakeTimers();
			jest.setSystemTime(fakeNow);

			// When - 아침 09:00으로 변경 (현재 시간 08시와 불일치)
			await job.handleReminderHourChanged({
				userId: "user-nomatch",
				timezone: "Asia/Seoul",
				morningReminderHour: 9,
				morningReminderMinute: 0,
			});

			// Then - 발송하지 않음
			expect(databaseService.user.findMany).not.toHaveBeenCalled();
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

			jest.useRealTimers();
		});

		it("변경된 분이 다른 버킷에 속하면 발송하지 않음", async () => {
			// Given - KST 08:00 = UTC 2024-01-15T23:00:00Z, 버킷 = :00 (0~29)
			const fakeNow = new Date("2024-01-15T23:00:00Z");
			jest.useFakeTimers();
			jest.setSystemTime(fakeNow);

			// When - 아침 08:30으로 변경 (버킷 30~59에 해당, 현재 버킷 0~29와 불일치)
			await job.handleReminderHourChanged({
				userId: "user-wrong-bucket",
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 30,
			});

			// Then - 발송하지 않음
			expect(databaseService.user.findMany).not.toHaveBeenCalled();
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

			jest.useRealTimers();
		});

		it("중복 방지: 이미 알림 받은 사용자에게는 캐치업 발송하지 않음", async () => {
			// Given - KST 08:10 = UTC 2024-01-15T23:10:00Z
			const fakeNow = new Date("2024-01-15T23:10:00Z");
			jest.useFakeTimers();
			jest.setSystemTime(fakeNow);

			const mockUser = createMockMorningUser({
				id: "user-already-notified",
				_count: { todos: 3 },
			});

			databaseService.user.findMany.mockResolvedValueOnce([mockUser] as never);

			// 이미 오늘 아침 리마인더를 받음
			notificationService.findAlreadyNotifiedUserIds.mockResolvedValueOnce(
				new Set(["user-already-notified"]),
			);

			// When
			await job.handleReminderHourChanged({
				userId: "user-already-notified",
				timezone: "Asia/Seoul",
				morningReminderHour: 8,
				morningReminderMinute: 10,
			});

			// Then - 중복이므로 발송하지 않음
			expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();

			jest.useRealTimers();
		});

		it("에러 발생 시 throw하지 않고 로깅", async () => {
			// Given - KST 08:00
			const fakeNow = new Date("2024-01-15T23:00:00Z");
			jest.useFakeTimers();
			jest.setSystemTime(fakeNow);

			const error = new Error("DB connection failed");
			databaseService.user.findMany.mockRejectedValue(error);

			// When & Then - 에러가 throw되지 않음
			await expect(
				job.handleReminderHourChanged({
					userId: "user-error",
					timezone: "Asia/Seoul",
					morningReminderHour: 8,
					morningReminderMinute: 0,
				}),
			).resolves.not.toThrow();

			jest.useRealTimers();
		});
	});
});

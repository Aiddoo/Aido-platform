import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import { StreakService } from "@/modules/user-settings/services/streak.service";

import { EveningReminderStrategy } from "./evening-reminder.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

// =============================================================================
// Tests
// =============================================================================

describe("EveningReminderStrategy", () => {
	let strategy: EveningReminderStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 18:00 = UTC 2024-01-16T09:00:00Z */
	const FAKE_NOW = new Date("2024-01-16T09:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 18,
		localMinute: 0,
		dayOfWeek: 2,
		today: dayjs.utc("2024-01-16").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } = await TestBed.solitary(
			EveningReminderStrategy,
		).compile();

		strategy = unit;
		database = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);

		// 기본 mock 설정
		database.user.findMany.mockResolvedValue([] as never);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue(
			undefined as never,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// =========================================================================
	// 프리미엄 사용자
	// =========================================================================

	it("프리미엄 사용자에게 커스텀 시간에 저녁 리마인더를 발송한다", async () => {
		const ctx = makeCtx({ localHour: 20, localMinute: 30 });

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "premium-1",
				todos: [{ completed: true }, { completed: false }],
				preference: { currentStreak: 0, lastCompletedDate: null },
			},
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });
		expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]).toMatchObject({
			userId: "premium-1",
			type: "EVENING_REMINDER",
		});
	});

	// =========================================================================
	// 무료 사용자
	// =========================================================================

	it("무료 사용자에게 18:00에 저녁 리마인더를 발송한다", async () => {
		const ctx = makeCtx({ localHour: 18, localMinute: 0 });

		database.user.findMany
			.mockResolvedValueOnce([] as never) // 프리미엄
			.mockResolvedValueOnce([
				{
					id: "free-1",
					todos: [{ completed: false }],
					preference: { currentStreak: 0, lastCompletedDate: null },
				},
			] as never); // 무료

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });
		expect(database.user.findMany).toHaveBeenCalledTimes(2);
	});

	// =========================================================================
	// StreakService.computeEffectiveStreak 호출 검증
	// =========================================================================

	it("StreakService.computeEffectiveStreak를 호출하여 스트릭 정보를 계산한다", async () => {
		const ctx = makeCtx();
		const computeSpy = jest.spyOn(StreakService, "computeEffectiveStreak");

		const lastCompletedDate = dayjs.utc("2024-01-15").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [{ completed: true }, { completed: true }],
				preference: { currentStreak: 5, lastCompletedDate },
			},
		] as never);

		await strategy.execute(ctx);

		expect(computeSpy).toHaveBeenCalledWith({
			currentStreak: 5,
			lastCompletedDate,
			todosCompleted: 2,
			todosTotal: 2,
			today: expect.any(Date),
		});

		computeSpy.mockRestore();
	});

	// =========================================================================
	// 완료/전체 개수 기반 메시지 분기
	// =========================================================================

	it("전체 완료 시 완료 메시지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [{ completed: true }, { completed: true }],
				preference: { currentStreak: 0, lastCompletedDate: null },
			},
		] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.eveningReminder(2, 2, 1, false);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("일부 완료 시 남은 개수 메시지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [
					{ completed: true },
					{ completed: false },
					{ completed: false },
				],
				preference: { currentStreak: 0, lastCompletedDate: null },
			},
		] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.eveningReminder(1, 3, 0, false);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("하나도 안 했을 때 해당 메시지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [{ completed: false }, { completed: false }],
				preference: { currentStreak: 0, lastCompletedDate: null },
			},
		] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.eveningReminder(0, 2, 0, false);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	// =========================================================================
	// 중복 방지
	// =========================================================================

	it("이미 알림 받은 사용자를 제외한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [{ completed: false }],
				preference: { currentStreak: 0, lastCompletedDate: null },
			},
			{
				id: "user-2",
				todos: [{ completed: false }],
				preference: { currentStreak: 0, lastCompletedDate: null },
			},
		] as never);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe("user-2");
	});

	// =========================================================================
	// 대상 없음
	// =========================================================================

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		const ctx = makeCtx();

		database.user.findMany
			.mockResolvedValueOnce([] as never)
			.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

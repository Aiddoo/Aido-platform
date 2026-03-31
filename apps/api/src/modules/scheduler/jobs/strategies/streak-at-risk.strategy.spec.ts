import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import { StreakService } from "@/modules/user-settings/services/streak.service";

import { StreakAtRiskStrategy } from "./streak-at-risk.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

// =============================================================================
// Tests
// =============================================================================

describe("StreakAtRiskStrategy", () => {
	let strategy: StreakAtRiskStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 20:00 = UTC 2024-01-16T11:00:00Z */
	const FAKE_NOW = new Date("2024-01-16T11:00:00Z");

	const TODAY = dayjs.utc("2024-01-16").startOf("day").toDate();
	const YESTERDAY = dayjs.utc("2024-01-15").startOf("day").toDate();

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 20,
		localMinute: 0,
		dayOfWeek: 2,
		today: TODAY,
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	/** 스트릭 5일, 어제 완료, 오늘 미완료 1개 → isAtRisk: true */
	const makeAtRiskUser = (id: string, streak = 5) => ({
		id,
		todos: [{ completed: false }],
		preference: { currentStreak: streak, lastCompletedDate: YESTERDAY },
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } =
			await TestBed.solitary(StreakAtRiskStrategy).compile();

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
		jest.restoreAllMocks();
	});

	// =========================================================================
	// 정상 발송
	// =========================================================================

	it("스트릭 3일+ & 미완료 유저에게 스트릭 위기 알림을 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			makeAtRiskUser("user-1", 5),
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });
		expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "STREAK_AT_RISK",
		});
	});

	// =========================================================================
	// StreakService.computeEffectiveStreak 호출 검증
	// =========================================================================

	it("StreakService.computeEffectiveStreak를 호출하여 스트릭을 재검증한다", async () => {
		const ctx = makeCtx();
		const computeSpy = jest.spyOn(StreakService, "computeEffectiveStreak");

		database.user.findMany.mockResolvedValueOnce([
			makeAtRiskUser("user-1", 7),
		] as never);

		await strategy.execute(ctx);

		expect(computeSpy).toHaveBeenCalledWith({
			currentStreak: 7,
			lastCompletedDate: YESTERDAY,
			todosCompleted: 0,
			todosTotal: 1,
			today: expect.any(Date),
		});

		computeSpy.mockRestore();
	});

	// =========================================================================
	// effective streak 값이 메시지에 사용되는지 검증
	// =========================================================================

	it("computeEffectiveStreak에서 반환한 streak 값을 메시지에 사용한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			makeAtRiskUser("user-1", 10),
		] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		// computeEffectiveStreak는 currentStreak(10)을 그대로 반환 (미완료 시)
		const expected = NotificationMessageBuilder.streakAtRisk(10);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	// =========================================================================
	// 필터링: 전체 완료 유저 제외
	// =========================================================================

	it("오늘 할일을 전부 완료한 유저는 제외한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-completed",
				todos: [{ completed: true }, { completed: true }],
				preference: { currentStreak: 5, lastCompletedDate: YESTERDAY },
			},
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	// =========================================================================
	// 필터링: isAtRisk === false 유저 제외
	// =========================================================================

	it("StreakService에서 isAtRisk가 false인 유저는 제외한다", async () => {
		const ctx = makeCtx();

		// lastCompletedDate가 null → isAtRisk: false
		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [{ completed: false }],
				preference: { currentStreak: 5, lastCompletedDate: null },
			},
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	// =========================================================================
	// 중복 방지
	// =========================================================================

	it("이미 알림 받은 사용자를 제외한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			makeAtRiskUser("user-1"),
			makeAtRiskUser("user-2"),
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

		database.user.findMany.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
		expect(
			notificationService.findAlreadyNotifiedUserIds,
		).not.toHaveBeenCalled();
	});
});

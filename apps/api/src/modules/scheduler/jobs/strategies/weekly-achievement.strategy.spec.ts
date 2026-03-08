import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";
import { WeeklyAchievementStrategy } from "./weekly-achievement.strategy";

// =============================================================================
// Tests
// =============================================================================

describe("WeeklyAchievementStrategy", () => {
	let strategy: WeeklyAchievementStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-14 (일요일) 20:00 = UTC 2024-01-14T11:00:00Z */
	const FAKE_NOW = new Date("2024-01-14T11:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 20,
		localMinute: 0,
		dayOfWeek: 0,
		today: dayjs.utc("2024-01-14").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-15").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } = await TestBed.solitary(
			WeeklyAchievementStrategy,
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
	// 주간 달성 배지 발송
	// =========================================================================

	it("해당 타임존의 모든 pushEnabled 유저에게 주간 달성 배지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [{ completed: true }, { completed: true }, { completed: false }],
			},
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		// 단일 쿼리로 premium/free 구분 없이 조회
		expect(database.user.findMany).toHaveBeenCalledTimes(1);
		expect(database.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					preference: { timezone: TZ, pushEnabled: true },
				}),
			}),
		);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.weeklyAchievement(2, 3);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "WEEKLY_ACHIEVEMENT",
			title: expected.title,
			body: expected.body,
		});
	});

	// =========================================================================
	// 인메모리 집계
	// =========================================================================

	it("인메모리 집계로 todos 배열에서 completed 카운트를 계산한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{
				id: "user-1",
				todos: [
					{ completed: true },
					{ completed: true },
					{ completed: true },
					{ completed: true },
					{ completed: true },
				],
			},
		] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		// 5/5 = 100% → perfect 메시지
		const expected = NotificationMessageBuilder.weeklyAchievement(5, 5);
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
				todos: [{ completed: true }],
			},
			{
				id: "user-2",
				todos: [{ completed: true }],
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

		database.user.findMany.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

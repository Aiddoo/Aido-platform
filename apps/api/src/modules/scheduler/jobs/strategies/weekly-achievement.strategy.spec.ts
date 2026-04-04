/**
 * WeeklyAchievementStrategy 전략 단위 테스트
 *
 * @description
 * WeeklyAchievementStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weekly-achievement.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { previousIsoWeekRange } from "@/common/date/utils/range";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { WeeklyAchievementService } from "@/modules/weekly-achievement/weekly-achievement.service";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";
import { WeeklyAchievementStrategy } from "./weekly-achievement.strategy";

describe("WeeklyAchievementStrategy — 주간 성취 전략", () => {
	let strategy: WeeklyAchievementStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;
	let weeklyAchievementService: Mocked<WeeklyAchievementService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-15 (월요일) 07:00 = UTC 2024-01-14T22:00:00Z */
	const FAKE_NOW = new Date("2024-01-14T22:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 7,
		localMinute: 0,
		dayOfWeek: 1,
		today: dayjs.utc("2024-01-15").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-16").startOf("day").toDate(),
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
		weeklyAchievementService = unitRef.get(WeeklyAchievementService);

		// 기본 mock 설정
		(database.todo.groupBy as jest.Mock).mockResolvedValue([]);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue(
			undefined as never,
		);
		weeklyAchievementService.upsertMany.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("이전 주 월~일 범위로 todo를 집계한다", async () => {
		// Given — 2024-01-15(월) 실행 → 이전 주: 01-08(월)~01-14(일)
		const ctx = makeCtx();

		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 3 } }])
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 2 } }]);

		// When
		await strategy.execute(ctx);

		// Then
		const { start, end } = previousIsoWeekRange(ctx.today);
		const expectedRange = { gte: start, lt: end };

		expect(database.todo.groupBy).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				where: expect.objectContaining({
					startDate: expectedRange,
				}),
			}),
		);
	});

	it("이전 주의 isoYear/isoWeek으로 기록을 저장한다", async () => {
		// Given — 2024-01-15(월) 실행 → 이전 주: ISO 2024-W02
		const ctx = makeCtx();

		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 3 } }])
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 2 } }]);

		// When
		await strategy.execute(ctx);

		// Then
		const { isoYear, isoWeek } = previousIsoWeekRange(ctx.today);
		expect(weeklyAchievementService.upsertMany).toHaveBeenCalledWith([
			expect.objectContaining({
				year: isoYear,
				week: isoWeek,
			}),
		]);
	});

	it("DB groupBy로 주간 todo를 집계한다", async () => {
		// Given
		const ctx = makeCtx();

		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 3 } }])
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 2 } }]);

		// When
		await strategy.execute(ctx);

		// Then
		expect(database.todo.groupBy).toHaveBeenCalledTimes(2);
		expect(database.todo.groupBy).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				by: ["userId"],
				_count: { id: true },
			}),
		);
		expect(database.todo.groupBy).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				by: ["userId"],
				where: expect.objectContaining({ completed: true }),
				_count: { id: true },
			}),
		);
	});

	it("모든 유저의 기록을 저장한다 (pushEnabled 무관)", async () => {
		// Given
		const ctx = makeCtx();

		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([
				{ userId: "user-push-on", _count: { id: 5 } },
				{ userId: "user-push-off", _count: { id: 3 } },
			])
			.mockResolvedValueOnce([
				{ userId: "user-push-on", _count: { id: 4 } },
				{ userId: "user-push-off", _count: { id: 2 } },
			]);

		// When
		await strategy.execute(ctx);

		// Then — upsertMany에 두 유저 모두 포함
		expect(weeklyAchievementService.upsertMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					userId: "user-push-on",
					totalTodos: 5,
					completedTodos: 4,
				}),
				expect.objectContaining({
					userId: "user-push-off",
					totalTodos: 3,
					completedTodos: 2,
				}),
			]),
		);
	});

	it("completedTodos > 0인 모든 유저에게 알림을 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([
				{ userId: "user-1", _count: { id: 5 } },
				{ userId: "user-2", _count: { id: 3 } },
			])
			.mockResolvedValueOnce([
				{ userId: "user-1", _count: { id: 4 } },
				{ userId: "user-2", _count: { id: 2 } },
			]);

		// When
		const result = await strategy.execute(ctx);

		// Then — completedTodos > 0인 두 유저 모두 알림 발송
		expect(result).toEqual({ sent: 2 });
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(2);
		expect(notifications?.map((n: { userId: string }) => n.userId)).toEqual(
			expect.arrayContaining(["user-1", "user-2"]),
		);
	});

	it("0% 완료 주차도 기록을 저장한다", async () => {
		// Given
		const ctx = makeCtx();

		// totalByUser에는 있지만 completedByUser에는 없음 → completedTodos=0
		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 5 } }])
			.mockResolvedValueOnce([]); // completed 없음

		// When
		await strategy.execute(ctx);

		// Then
		expect(weeklyAchievementService.upsertMany).toHaveBeenCalledWith([
			expect.objectContaining({
				userId: "user-1",
				totalTodos: 5,
				completedTodos: 0,
			}),
		]);
	});

	it("dedup은 알림만 필터하고 기록 저장은 독립적이다", async () => {
		// Given
		const ctx = makeCtx();

		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([
				{ userId: "user-1", _count: { id: 3 } },
				{ userId: "user-2", _count: { id: 4 } },
			])
			.mockResolvedValueOnce([
				{ userId: "user-1", _count: { id: 2 } },
				{ userId: "user-2", _count: { id: 3 } },
			]);

		// user-1은 이미 알림 받음
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		// When
		const result = await strategy.execute(ctx);

		// Then — 기록은 두 유저 모두 저장
		expect(weeklyAchievementService.upsertMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ userId: "user-1" }),
				expect.objectContaining({ userId: "user-2" }),
			]),
		);
		// 알림은 user-2만
		expect(result).toEqual({ sent: 1 });
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe("user-2");
	});

	it("대상이 없으면 groupBy 이후 아무것도 호출하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		(database.todo.groupBy as jest.Mock).mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(weeklyAchievementService.upsertMany).not.toHaveBeenCalled();
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("알림 대상이 없어도 기록은 저장한다", async () => {
		// Given
		const ctx = makeCtx();

		// completed > 0인 유저 없음 → 알림 대상 없음
		(database.todo.groupBy as jest.Mock)
			.mockResolvedValueOnce([{ userId: "user-1", _count: { id: 5 } }])
			.mockResolvedValueOnce([]); // completed 없음

		// When
		const result = await strategy.execute(ctx);

		// Then — 기록 저장됨 + 알림 미발송
		expect(weeklyAchievementService.upsertMany).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

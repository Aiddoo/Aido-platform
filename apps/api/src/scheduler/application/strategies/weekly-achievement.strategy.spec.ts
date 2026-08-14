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
import { NotificationFacade } from "@/notification";
import { previousIsoWeekRange } from "@/shared/domain/date/utils/range";
import { WeeklyAchievementWriterAccess } from "@/weekly-achievement";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import {
	WEEKLY_ACHIEVEMENT_STATS_READER,
	type WeeklyAchievementStatsReaderPort,
} from "../ports/weekly-achievement-stats-reader.port";
import { WeeklyAchievementStrategy } from "./weekly-achievement.strategy";

describe("WeeklyAchievementStrategy — 주간 성취 전략", () => {
	let strategy: WeeklyAchievementStrategy;
	let reader: Mocked<WeeklyAchievementStatsReaderPort>;
	let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
	let notificationService: Mocked<NotificationFacade>;
	let weeklyAchievementWriter: Mocked<WeeklyAchievementWriterAccess>;

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
		reader = unitRef.get(WEEKLY_ACHIEVEMENT_STATS_READER);
		preferenceReader = unitRef.get(SCHEDULER_PREFERENCE_READER);
		notificationService = unitRef.get(NotificationFacade);
		weeklyAchievementWriter = unitRef.get(WeeklyAchievementWriterAccess);

		// 기본 mock 설정
		reader.groupTotalTodosByUser.mockResolvedValue([]);
		reader.groupCompletedTodosByUser.mockResolvedValue([]);
		reader.findFreeRecipientIds.mockImplementation(
			async (userIds) => new Set(userIds),
		);
		preferenceReader.findUserLocales.mockResolvedValue(new Map());
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
		weeklyAchievementWriter.upsertMany.mockResolvedValue(undefined);
	});

	it("주간 달성 푸시는 무료 사용자에게만 보내고 프리미엄 기록은 저장만 한다", async () => {
		const ctx = makeCtx();
		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "free-user", count: 3 },
			{ userId: "premium-user", count: 3 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([
			{ userId: "free-user", count: 2 },
			{ userId: "premium-user", count: 3 },
		]);
		reader.findFreeRecipientIds.mockResolvedValue(new Set(["free-user"]));

		await strategy.execute(ctx);

		expect(weeklyAchievementWriter.upsertMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ userId: "free-user" }),
				expect.objectContaining({ userId: "premium-user" }),
			]),
		);
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications?.map((notification) => notification.userId)).toEqual([
			"free-user",
		]);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("이전 주 월~일 범위로 todo를 집계한다", async () => {
		// Given — 2024-01-15(월) 실행 → 이전 주: 01-08(월)~01-14(일)
		const ctx = makeCtx();

		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 3 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 2 },
		]);

		// When
		await strategy.execute(ctx);

		// Then
		const { start, end } = previousIsoWeekRange(ctx.today);

		expect(reader.groupTotalTodosByUser).toHaveBeenCalledWith(
			expect.objectContaining({
				periodStart: start,
				periodEnd: end,
			}),
		);
	});

	it("이전 주의 isoYear/isoWeek으로 기록을 저장한다", async () => {
		// Given — 2024-01-15(월) 실행 → 이전 주: ISO 2024-W02
		const ctx = makeCtx();

		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 3 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 2 },
		]);

		// When
		await strategy.execute(ctx);

		// Then
		const { isoYear, isoWeek } = previousIsoWeekRange(ctx.today);
		expect(weeklyAchievementWriter.upsertMany).toHaveBeenCalledWith([
			expect.objectContaining({
				year: isoYear,
				week: isoWeek,
			}),
		]);
	});

	it("리더로 주간 todo를 집계한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 3 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 2 },
		]);

		// When
		await strategy.execute(ctx);

		// Then
		expect(reader.groupTotalTodosByUser).toHaveBeenCalledTimes(1);
		expect(reader.groupCompletedTodosByUser).toHaveBeenCalledTimes(1);
	});

	it("모든 유저의 기록을 저장한다 (pushEnabled 무관)", async () => {
		// Given
		const ctx = makeCtx();

		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-push-on", count: 5 },
			{ userId: "user-push-off", count: 3 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([
			{ userId: "user-push-on", count: 4 },
			{ userId: "user-push-off", count: 2 },
		]);

		// When
		await strategy.execute(ctx);

		// Then — upsertMany에 두 유저 모두 포함
		expect(weeklyAchievementWriter.upsertMany).toHaveBeenCalledWith(
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

		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 5 },
			{ userId: "user-2", count: 3 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 4 },
			{ userId: "user-2", count: 2 },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then — completedTodos > 0인 두 유저 모두 알림 발송
		expect(result).toEqual({ sent: 2 });
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(2);
		expect(notifications?.map((n) => n.userId)).toEqual(
			expect.arrayContaining(["user-1", "user-2"]),
		);
	});

	it("0% 완료 주차도 기록을 저장한다", async () => {
		// Given
		const ctx = makeCtx();

		// totalByUser에는 있지만 completedByUser에는 없음 → completedTodos=0
		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 5 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([]); // completed 없음

		// When
		await strategy.execute(ctx);

		// Then
		expect(weeklyAchievementWriter.upsertMany).toHaveBeenCalledWith([
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

		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 3 },
			{ userId: "user-2", count: 4 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 2 },
			{ userId: "user-2", count: 3 },
		]);

		// user-1은 이미 알림 받음
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		// When
		const result = await strategy.execute(ctx);

		// Then — 기록은 두 유저 모두 저장
		expect(weeklyAchievementWriter.upsertMany).toHaveBeenCalledWith(
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

	it("대상이 없으면 집계 이후 아무것도 호출하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		reader.groupTotalTodosByUser.mockResolvedValue([]);
		reader.groupCompletedTodosByUser.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(weeklyAchievementWriter.upsertMany).not.toHaveBeenCalled();
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("알림 대상이 없어도 기록은 저장한다", async () => {
		// Given
		const ctx = makeCtx();

		// completed > 0인 유저 없음 → 알림 대상 없음
		reader.groupTotalTodosByUser.mockResolvedValue([
			{ userId: "user-1", count: 5 },
		]);
		reader.groupCompletedTodosByUser.mockResolvedValue([]); // completed 없음

		// When
		const result = await strategy.execute(ctx);

		// Then — 기록 저장됨 + 알림 미발송
		expect(weeklyAchievementWriter.upsertMany).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

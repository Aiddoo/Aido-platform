/**
 * StreakAtRiskStrategy 전략 단위 테스트
 *
 * @description
 * StreakAtRiskStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test streak-at-risk.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { NotificationMessageBuilder, NotificationSender } from "@/notification";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import type { UserWithTodosAndStreak } from "../ports/scheduler-read-models";
import { StreakAtRiskStrategy } from "./streak-at-risk.strategy";

describe("StreakAtRiskStrategy — 연속 달성 위험 전략", () => {
	let strategy: StreakAtRiskStrategy;
	let reader: Mocked<ReEngagementReaderPort>;
	let notificationService: Mocked<NotificationSender>;

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
	const makeAtRiskUser = (id: string, streak = 5): UserWithTodosAndStreak => ({
		id,
		todos: [{ completed: false }],
		preference: {
			currentStreak: streak,
			lastCompletedDate: YESTERDAY,
			locale: "ko",
		},
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } = await TestBed.solitary(StreakAtRiskStrategy).compile();

		strategy = unit;
		reader = unitRef.get(RE_ENGAGEMENT_READER);
		notificationService = unitRef.get(NotificationSender);

		// 기본 mock 설정
		reader.findStreakAtRiskUsers.mockResolvedValue([]);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("스트릭 3일+ & 미완료 유저에게 스트릭 위기 알림을 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findStreakAtRiskUsers.mockResolvedValue([makeAtRiskUser("user-1", 5)]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });
		expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

		const notifications = notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "STREAK_AT_RISK",
		});
	});

	it("effective streak를 재검증해 위기 유저에게 스트릭 값으로 알림을 보낸다", async () => {
		// Given — 어제 완료(YESTERDAY) + 오늘 0/1 미완료 → effective streak = 7 유지
		const ctx = makeCtx();

		reader.findStreakAtRiskUsers.mockResolvedValue([makeAtRiskUser("user-1", 7)]);

		// When
		await strategy.execute(ctx);

		// Then — computeEffectiveStreak가 반환한 streak(7)이 메시지에 사용됨
		const notifications = notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.streakAtRisk(7);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			title: expected.title,
			body: expected.body,
		});
	});

	it("computeEffectiveStreak에서 반환한 streak 값을 메시지에 사용한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findStreakAtRiskUsers.mockResolvedValue([makeAtRiskUser("user-1", 10)]);

		// When
		await strategy.execute(ctx);

		// Then
		const notifications = notificationService.createAndSendBatch.mock.calls[0]?.[0];
		// computeEffectiveStreak는 currentStreak(10)을 그대로 반환 (미완료 시)
		const expected = NotificationMessageBuilder.streakAtRisk(10);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("오늘 할일을 전부 완료한 유저는 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findStreakAtRiskUsers.mockResolvedValue([
			{
				id: "user-completed",
				todos: [{ completed: true }, { completed: true }],
				preference: {
					currentStreak: 5,
					lastCompletedDate: YESTERDAY,
					locale: "ko",
				},
			},
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("StreakService에서 isAtRisk가 false인 유저는 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		// lastCompletedDate가 null → isAtRisk: false
		reader.findStreakAtRiskUsers.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: false }],
				preference: {
					currentStreak: 5,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("이미 알림 받은 사용자를 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findStreakAtRiskUsers.mockResolvedValue([
			makeAtRiskUser("user-1"),
			makeAtRiskUser("user-2"),
		]);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });
		const notifications = notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe("user-2");
	});

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		// Given — beforeEach 기본 설정
		const ctx = makeCtx();

		reader.findStreakAtRiskUsers.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
		expect(notificationService.findAlreadyNotifiedUserIds).not.toHaveBeenCalled();
	});
});

/**
 * EveningReminderStrategy 전략 단위 테스트
 *
 * @description
 * EveningReminderStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test evening-reminder.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";
import { NotificationFacade, NotificationMessageBuilder } from "@/notification";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	SCHEDULED_REMINDER_READER,
	type ScheduledReminderReaderPort,
} from "../ports/scheduled-reminder-reader.port";
import { EveningReminderStrategy } from "./evening-reminder.strategy";

describe("EveningReminderStrategy — 저녁 리마인더 전략", () => {
	let strategy: EveningReminderStrategy;
	let reader: Mocked<ScheduledReminderReaderPort>;
	let notificationService: Mocked<NotificationFacade>;

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
		jest.spyOn(Math, "random").mockReturnValue(0);

		const { unit, unitRef } = await TestBed.solitary(
			EveningReminderStrategy,
		).compile();

		strategy = unit;
		reader = unitRef.get(SCHEDULED_REMINDER_READER);
		notificationService = unitRef.get(NotificationFacade);

		// 기본 mock 설정
		reader.findPremiumEveningReminderUsers.mockResolvedValue([]);
		reader.findFreeEveningReminderUsers.mockResolvedValue([]);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("프리미엄 사용자에게 커스텀 시간에 저녁 리마인더를 발송한다", async () => {
		// Given
		const ctx = makeCtx({ localHour: 20, localMinute: 30 });

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: "premium-1",
				todos: [{ completed: true }, { completed: false }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
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

	it("무료 사용자에게 18:00에 저녁 리마인더를 발송한다", async () => {
		// Given
		const ctx = makeCtx({ localHour: 18, localMinute: 0 });

		reader.findFreeEveningReminderUsers.mockResolvedValue([
			{
				id: "free-1",
				todos: [{ completed: false }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });
		expect(reader.findPremiumEveningReminderUsers).toHaveBeenCalledTimes(1);
		expect(reader.findFreeEveningReminderUsers).toHaveBeenCalledTimes(1);
	});

	it("전체 완료 유저의 effective streak를 계산해 완료 메시지를 발송한다", async () => {
		// Given — 어제(2024-01-15) 완료 후 오늘도 전체 완료 → effective streak = 6
		const ctx = makeCtx();
		const lastCompletedDate = dayjs.utc("2024-01-15").startOf("day").toDate();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: true }, { completed: true }],
				preference: { currentStreak: 5, lastCompletedDate, locale: "ko" },
			},
		]);

		// When
		await strategy.execute(ctx);

		// Then — 완료 유저 1명에게 발송 (streak 계산 경로 실행)
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]).toMatchObject({ userId: "user-1" });
	});

	it("전체 완료 시 완료 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: true }, { completed: true }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		// When
		await strategy.execute(ctx);

		// Then
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.eveningReminder(2, 2, 1, false);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("일부 완료 시 남은 개수 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: "user-1",
				todos: [
					{ completed: true },
					{ completed: false },
					{ completed: false },
				],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		// When
		await strategy.execute(ctx);

		// Then
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.eveningReminder(1, 3, 0, false);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("하나도 안 했을 때 해당 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: false }, { completed: false }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		// When
		await strategy.execute(ctx);

		// Then
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.eveningReminder(0, 2, 0, false);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("이미 알림 받은 사용자를 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: "user-1",
				todos: [{ completed: false }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
			{
				id: "user-2",
				todos: [{ completed: false }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe("user-2");
	});

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([]);
		reader.findFreeEveningReminderUsers.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

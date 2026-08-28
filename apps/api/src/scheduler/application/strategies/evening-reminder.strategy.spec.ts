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
import { TEST_CUID } from "@test/fixtures";
import dayjs from "dayjs";

import {
	createEveningReminderNotificationMessage,
	NotificationHistoryReader,
	NotificationPublisher,
} from "@/notification";

import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	SCHEDULED_REMINDER_READER,
	type ScheduledReminderReaderPort,
} from "../ports/scheduled-reminder-reader.port";
import { EveningReminderStrategy } from "./evening-reminder.strategy";

describe("EveningReminderStrategy — 저녁 리마인더 전략", () => {
	let strategy: EveningReminderStrategy;
	let reader: Mocked<ScheduledReminderReaderPort>;
	let notificationPublisher: Mocked<NotificationPublisher>;
	let notificationHistoryReader: Mocked<NotificationHistoryReader>;

	const TZ = "Asia/Seoul";
	const VARIANT_CONTEXT = {
		campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
		recipientId: TEST_CUID.USER_1,
		occurrenceKey: "2024-01-16",
	} as const;

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

		const { unit, unitRef } = await TestBed.solitary(EveningReminderStrategy).compile();

		strategy = unit;
		reader = unitRef.get(SCHEDULED_REMINDER_READER);
		notificationPublisher = unitRef.get(NotificationPublisher);
		notificationHistoryReader = unitRef.get(NotificationHistoryReader);

		// 기본 mock 설정
		reader.findPremiumEveningReminderUsers.mockResolvedValue([]);
		reader.findFreeEveningReminderUsers.mockResolvedValue([]);
		notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
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
				id: TEST_CUID.USER_1,
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
		expect(result).toEqual({
			sent: 1,
			recipientUserIds: [TEST_CUID.USER_1],
		});
		expect(notificationPublisher.publishBatch).toHaveBeenCalledTimes(1);

		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]).toMatchObject({
			userId: TEST_CUID.USER_1,
			type: "EVENING_REMINDER",
		});
	});

	it("무료 사용자에게 19:00에 저녁 리마인더를 발송한다", async () => {
		// Given
		const ctx = makeCtx({ localHour: 19, localMinute: 0 });

		reader.findFreeEveningReminderUsers.mockResolvedValue([
			{
				id: TEST_CUID.USER_2,
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
		expect(result).toEqual({
			sent: 1,
			recipientUserIds: [TEST_CUID.USER_2],
		});
		expect(reader.findPremiumEveningReminderUsers).toHaveBeenCalledTimes(1);
		expect(reader.findFreeEveningReminderUsers).toHaveBeenCalledTimes(1);
	});

	it("전체 완료 유저의 effective streak를 계산해 완료 메시지를 발송한다", async () => {
		// Given — 어제(2024-01-15) 완료 후 오늘도 전체 완료 → effective streak = 6
		const ctx = makeCtx();
		const lastCompletedDate = dayjs.utc("2024-01-15").startOf("day").toDate();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: TEST_CUID.USER_1,
				todos: [{ completed: true }, { completed: true }],
				preference: { currentStreak: 5, lastCompletedDate, locale: "ko" },
			},
		]);

		// When
		await strategy.execute(ctx);

		// Then — 완료 유저 1명에게 발송 (streak 계산 경로 실행)
		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]).toMatchObject({ userId: TEST_CUID.USER_1 });
	});

	it("전체 완료 시 완료 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: TEST_CUID.USER_1,
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
		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		const expected = createEveningReminderNotificationMessage({
			completed: 2,
			total: 2,
			streak: 1,
			isStreakAtRisk: false,
			locale: "ko",
			variantContext: {
				campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
				recipientId: TEST_CUID.USER_1,
				occurrenceKey: "2024-01-16",
			},
		});
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
			campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
			variantId: expected.variantId,
		});
	});

	it("일부 완료 시 남은 개수 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([
			{
				id: TEST_CUID.USER_1,
				todos: [{ completed: true }, { completed: false }, { completed: false }],
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
		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		const expected = createEveningReminderNotificationMessage({
			completed: 1,
			total: 3,
			locale: "ko",
			variantContext: VARIANT_CONTEXT,
		});
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
				id: TEST_CUID.USER_1,
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
		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		const expected = createEveningReminderNotificationMessage({
			completed: 0,
			total: 2,
			locale: "ko",
			variantContext: VARIANT_CONTEXT,
		});
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
				id: TEST_CUID.USER_1,
				todos: [{ completed: false }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
			{
				id: TEST_CUID.USER_2,
				todos: [{ completed: false }],
				preference: {
					currentStreak: 0,
					lastCompletedDate: null,
					locale: "ko",
				},
			},
		]);

		notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set([TEST_CUID.USER_1]),
		);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({
			sent: 1,
			recipientUserIds: [TEST_CUID.USER_2],
		});
		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe(TEST_CUID.USER_2);
	});

	it("대상이 없으면 publishBatch를 호출하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumEveningReminderUsers.mockResolvedValue([]);
		reader.findFreeEveningReminderUsers.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0, recipientUserIds: [] });
		expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
	});
});

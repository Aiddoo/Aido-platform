/**
 * MorningReminderStrategy 전략 단위 테스트
 *
 * @description
 * MorningReminderStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test morning-reminder.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TEST_CUID } from "@test/fixtures";
import dayjs from "dayjs";
import { NotificationFacade, NotificationMessageBuilder } from "@/notification";

import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	SCHEDULED_REMINDER_READER,
	type ScheduledReminderReaderPort,
} from "../ports/scheduled-reminder-reader.port";
import { MorningReminderStrategy } from "./morning-reminder.strategy";

describe("MorningReminderStrategy — 아침 리마인더 전략", () => {
	let strategy: MorningReminderStrategy;
	let reader: Mocked<ScheduledReminderReaderPort>;
	let notificationService: Mocked<NotificationFacade>;

	const TZ = "Asia/Seoul";
	const VARIANT_CONTEXT = {
		campaignKey: SCHEDULER_CAMPAIGN_KEY.MORNING_REMINDER,
		recipientId: TEST_CUID.USER_1,
		occurrenceKey: "2024-01-16",
	} as const;

	/** KST 2024-01-16 08:00 = UTC 2024-01-15T23:00:00Z */
	const FAKE_NOW = new Date("2024-01-15T23:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 8,
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
			MorningReminderStrategy,
		).compile();

		strategy = unit;
		reader = unitRef.get(SCHEDULED_REMINDER_READER);
		notificationService = unitRef.get(NotificationFacade);

		// 기본 mock 설정
		reader.findPremiumMorningReminderUsers.mockResolvedValue([]);
		reader.findFreeMorningReminderUsers.mockResolvedValue([]);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("프리미엄 사용자에게 커스텀 시간에 아침 리마인더를 발송한다", async () => {
		// Given
		const ctx = makeCtx({ localHour: 9, localMinute: 30 });

		reader.findPremiumMorningReminderUsers.mockResolvedValue([
			{ id: TEST_CUID.USER_1, preference: null, _count: { todos: 3 } },
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
			userId: TEST_CUID.USER_1,
			type: "MORNING_REMINDER",
		});
	});

	it("무료 사용자에게 08:00에 아침 리마인더를 발송한다", async () => {
		// Given
		const ctx = makeCtx({ localHour: 8, localMinute: 0 });

		reader.findFreeMorningReminderUsers.mockResolvedValue([
			{ id: TEST_CUID.USER_2, preference: null, _count: { todos: 2 } },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });
		expect(reader.findPremiumMorningReminderUsers).toHaveBeenCalledTimes(1);
		expect(reader.findFreeMorningReminderUsers).toHaveBeenCalledTimes(1);
	});

	it("무료 사용자는 비고정 시간에 리마인더를 발송하지 않는다", async () => {
		// Given
		const ctx = makeCtx({ localHour: 9, localMinute: 30 });

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		// 프리미엄 쿼리만 호출, 무료 사용자 쿼리 스킵
		expect(reader.findPremiumMorningReminderUsers).toHaveBeenCalledTimes(1);
		expect(reader.findFreeMorningReminderUsers).not.toHaveBeenCalled();
	});

	it("catch-up(userId) 시 무료 사용자 쿼리를 스킵한다", async () => {
		// Given
		const ctx = makeCtx({
			localHour: 8,
			localMinute: 0,
			userId: TEST_CUID.USER_1,
		});

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		// userId가 있으므로 무료 사용자 쿼리 스킵
		expect(reader.findPremiumMorningReminderUsers).toHaveBeenCalledTimes(1);
		expect(reader.findFreeMorningReminderUsers).not.toHaveBeenCalled();
	});

	it("할일이 있는 사용자에게 morningReminder(count) 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumMorningReminderUsers.mockResolvedValue([
			{ id: TEST_CUID.USER_1, preference: null, _count: { todos: 5 } },
		]);

		// When
		await strategy.execute(ctx);

		// Then
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.morningReminder(
			5,
			"ko",
			VARIANT_CONTEXT,
		);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("할일이 없는 사용자에게 morningNoTodo 메시지를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumMorningReminderUsers.mockResolvedValue([
			{ id: TEST_CUID.USER_1, preference: null, _count: { todos: 0 } },
		]);

		// When
		await strategy.execute(ctx);

		// Then
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.morningNoTodo(
			"ko",
			VARIANT_CONTEXT,
		);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("이미 알림 받은 사용자를 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findPremiumMorningReminderUsers.mockResolvedValue([
			{ id: TEST_CUID.USER_1, preference: null, _count: { todos: 3 } },
			{ id: TEST_CUID.USER_2, preference: null, _count: { todos: 2 } },
		]);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set([TEST_CUID.USER_1]),
		);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });
		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe(TEST_CUID.USER_2);
	});

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

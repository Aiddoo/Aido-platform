import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import { MorningReminderStrategy } from "./morning-reminder.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

// =============================================================================
// Tests
// =============================================================================

describe("MorningReminderStrategy", () => {
	let strategy: MorningReminderStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

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
	// 프리미엄 사용자
	// =========================================================================

	it("프리미엄 사용자에게 커스텀 시간에 아침 리마인더를 발송한다", async () => {
		const ctx = makeCtx({ localHour: 9, localMinute: 30 });

		database.user.findMany
			.mockResolvedValueOnce([
				{ id: "premium-1", _count: { todos: 3 } },
			] as never)
			.mockResolvedValueOnce([] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });
		expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]).toMatchObject({
			userId: "premium-1",
			type: "MORNING_REMINDER",
		});
	});

	// =========================================================================
	// 무료 사용자
	// =========================================================================

	it("무료 사용자에게 08:00에 아침 리마인더를 발송한다", async () => {
		const ctx = makeCtx({ localHour: 8, localMinute: 0 });

		database.user.findMany
			.mockResolvedValueOnce([] as never) // 프리미엄
			.mockResolvedValueOnce([{ id: "free-1", _count: { todos: 2 } }] as never); // 무료

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });
		expect(database.user.findMany).toHaveBeenCalledTimes(2);
	});

	it("무료 사용자는 비고정 시간에 리마인더를 발송하지 않는다", async () => {
		const ctx = makeCtx({ localHour: 9, localMinute: 30 });

		database.user.findMany.mockResolvedValueOnce([] as never); // 프리미엄

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		// 프리미엄 쿼리 1번만 호출, 무료 사용자 쿼리 스킵
		expect(database.user.findMany).toHaveBeenCalledTimes(1);
	});

	// =========================================================================
	// catch-up (userId 지정)
	// =========================================================================

	it("catch-up(userId) 시 무료 사용자 쿼리를 스킵한다", async () => {
		const ctx = makeCtx({
			localHour: 8,
			localMinute: 0,
			userId: "user-1",
		});

		database.user.findMany.mockResolvedValueOnce([] as never); // 프리미엄

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		// userId가 있으므로 무료 사용자 쿼리 스킵
		expect(database.user.findMany).toHaveBeenCalledTimes(1);
	});

	// =========================================================================
	// 메시지 분기
	// =========================================================================

	it("할일이 있는 사용자에게 morningReminder(count) 메시지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany
			.mockResolvedValueOnce([{ id: "user-1", _count: { todos: 5 } }] as never)
			.mockResolvedValueOnce([] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.morningReminder(5);
		expect(notifications?.[0]).toMatchObject({
			title: expected.title,
			body: expected.body,
		});
	});

	it("할일이 없는 사용자에게 morningNoTodo 메시지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany
			.mockResolvedValueOnce([{ id: "user-1", _count: { todos: 0 } }] as never)
			.mockResolvedValueOnce([] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.morningNoTodo();
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

		database.user.findMany
			.mockResolvedValueOnce([
				{ id: "user-1", _count: { todos: 3 } },
				{ id: "user-2", _count: { todos: 2 } },
			] as never)
			.mockResolvedValueOnce([] as never);

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

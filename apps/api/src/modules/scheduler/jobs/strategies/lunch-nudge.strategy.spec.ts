import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import { LunchNudgeStrategy } from "./lunch-nudge.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

// =============================================================================
// Tests
// =============================================================================

describe("LunchNudgeStrategy", () => {
	let strategy: LunchNudgeStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 12:30 = UTC 2024-01-16T03:30:00Z */
	const FAKE_NOW = new Date("2024-01-16T03:30:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 12,
		localMinute: 30,
		dayOfWeek: 2,
		today: dayjs.utc("2024-01-16").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } =
			await TestBed.solitary(LunchNudgeStrategy).compile();

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
	// 정상 발송
	// =========================================================================

	it("오늘 할일이 있지만 완료가 0개인 유저에게 점심 넛지를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1" },
			{ id: "user-2" },
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 2 });
		expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(2);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "LUNCH_NUDGE",
		});
		expect(notifications?.[1]).toMatchObject({
			userId: "user-2",
			type: "LUNCH_NUDGE",
		});
	});

	// =========================================================================
	// 메시지 내용
	// =========================================================================

	it("NotificationMessageBuilder.lunchNudge() 메시지를 사용한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([{ id: "user-1" }] as never);

		await strategy.execute(ctx);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.lunchNudge();
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
			{ id: "user-1" },
			{ id: "user-2" },
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

	it("모든 유저가 이미 알림을 받았으면 발송하지 않는다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([{ id: "user-1" }] as never);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
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

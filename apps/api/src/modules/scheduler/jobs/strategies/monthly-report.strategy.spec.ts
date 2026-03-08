import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import { MonthlyReportStrategy } from "./monthly-report.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

// =============================================================================
// Tests
// =============================================================================

describe("MonthlyReportStrategy", () => {
	let strategy: MonthlyReportStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-02-01 (목요일) 08:00 = UTC 2024-01-31T23:00:00Z */
	const FAKE_NOW = new Date("2024-01-31T23:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 8,
		localMinute: 0,
		dayOfWeek: 4,
		today: dayjs.utc("2024-02-01").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-02-02").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } = await TestBed.solitary(
			MonthlyReportStrategy,
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
	// 프리미엄 사용자
	// =========================================================================

	it("프리미엄 사용자에게 월간 리포트를 발송한다", async () => {
		const ctx = makeCtx({ localHour: 9, localMinute: 30 });

		database.user.findMany.mockResolvedValueOnce([
			{ id: "premium-1" },
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.monthlyReport();
		expect(notifications?.[0]).toMatchObject({
			userId: "premium-1",
			type: "MONTHLY_REPORT",
			title: expected.title,
			body: expected.body,
		});
	});

	// =========================================================================
	// 무료 사용자
	// =========================================================================

	it("무료 사용자에게 08:00에 월간 리포트를 발송한다", async () => {
		const ctx = makeCtx({ localHour: 8, localMinute: 0 });

		database.user.findMany
			.mockResolvedValueOnce([] as never) // 프리미엄
			.mockResolvedValueOnce([{ id: "free-1" }] as never); // 무료

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });
		expect(database.user.findMany).toHaveBeenCalledTimes(2);
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

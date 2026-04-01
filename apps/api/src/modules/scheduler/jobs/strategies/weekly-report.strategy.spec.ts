import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";
import { WeeklyReportStrategy } from "./weekly-report.strategy";

// =============================================================================
// Tests
// =============================================================================

describe("WeeklyReportStrategy", () => {
	let strategy: WeeklyReportStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-15 (월요일) 09:00 = UTC 2024-01-15T00:00:00Z */
	const FAKE_NOW = new Date("2024-01-15T00:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 9,
		localMinute: 0,
		dayOfWeek: 1,
		today: dayjs.utc("2024-01-15").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-16").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } =
			await TestBed.solitary(WeeklyReportStrategy).compile();

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
	// 프리미엄 유저 대상 발송
	// =========================================================================

	it("프리미엄 유저 전체에게 주간 리포트를 발송한다", async () => {
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([{ id: "user-1" }] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		// AI 리포트는 유료 기능 → 프리미엄 유저만 조회 (pushEnabled 필터 없음, 푸시 전송은 PushDeliveryService가 담당)
		expect(database.user.findMany).toHaveBeenCalledTimes(1);
		expect(database.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					preference: { timezone: TZ },
					OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				}),
			}),
		);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.weeklyReport();
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "WEEKLY_REPORT",
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

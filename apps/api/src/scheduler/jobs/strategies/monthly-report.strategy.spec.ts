/**
 * MonthlyReportStrategy 전략 단위 테스트
 *
 * @description
 * MonthlyReportStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test monthly-report.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";
import {
	NotificationMessageBuilder,
	NotificationService,
} from "@/notification";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { MonthlyReportStrategy } from "./monthly-report.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

describe("MonthlyReportStrategy — 월간 리포트 전략", () => {
	let strategy: MonthlyReportStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-02-01 (목요일) 10:00 = UTC 2024-02-01T01:00:00Z */
	const FAKE_NOW = new Date("2024-02-01T01:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 10,
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
		database.userPreference.findMany.mockResolvedValue([] as never);
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

	it("프리미엄 유저 전체에게 월간 리포트를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([{ id: "user-1" }] as never);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });

		// AI 리포트는 유료 기능 → 프리미엄 유저만 조회 (push 여부는 PushDeliveryService가 판단)
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
		const expected = NotificationMessageBuilder.monthlyReport();
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "MONTHLY_REPORT",
			title: expected.title,
			body: expected.body,
		});
	});

	it("이미 알림 받은 사용자를 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1" },
			{ id: "user-2" },
		] as never);

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
		// Given — beforeEach 기본 설정
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([] as never);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

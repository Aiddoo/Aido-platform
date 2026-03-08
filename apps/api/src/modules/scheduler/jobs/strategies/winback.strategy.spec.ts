import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import type { IDedupProvider } from "@/common/dedup/interfaces/dedup.interface";
import { DEDUP_PROVIDER } from "@/common/dedup/interfaces/dedup.interface";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import type { TimezoneContext } from "./timezone-reminder-strategy.interface";
import { WinbackStrategy } from "./winback.strategy";

// =============================================================================
// Tests
// =============================================================================

describe("WinbackStrategy", () => {
	let strategy: WinbackStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;
	let dedupProvider: Mocked<IDedupProvider>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 12:00 = UTC 2024-01-16T03:00:00Z */
	const FAKE_NOW = new Date("2024-01-16T03:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 12,
		localMinute: 0,
		dayOfWeek: 2,
		today: dayjs.utc("2024-01-16").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } = await TestBed.solitary(WinbackStrategy).compile();

		strategy = unit;
		database = unitRef.get(DatabaseService);
		notificationService = unitRef.get(NotificationService);
		dedupProvider = unitRef.get(DEDUP_PROVIDER);

		// 기본 mock 설정
		database.user.findMany.mockResolvedValue([] as never);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue(
			undefined as never,
		);
		dedupProvider.isMember.mockResolvedValue(false);
		dedupProvider.addMembers.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// =========================================================================
	// 단계별 Win-back 발송
	// =========================================================================

	it("7일 미접속 유저에게 day7 Win-back을 발송한다", async () => {
		const ctx = makeCtx();
		const sevenDaysAgo = dayjs.utc("2024-01-09").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: sevenDaysAgo },
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.winback(7);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "WINBACK",
			title: expected.title,
			body: expected.body,
			metadata: { stage: "day7" },
		});
	});

	it("14일 미접속 유저에게 day14 Win-back을 발송한다", async () => {
		const ctx = makeCtx();
		const fourteenDaysAgo = dayjs.utc("2024-01-02").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: fourteenDaysAgo },
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.winback(14);
		expect(notifications?.[0]).toMatchObject({
			metadata: { stage: "day14" },
			title: expected.title,
			body: expected.body,
		});
	});

	it("3일 미접속 유저에게 day3 Win-back을 발송한다", async () => {
		const ctx = makeCtx();
		const threeDaysAgo = dayjs.utc("2024-01-13").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: threeDaysAgo },
		] as never);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.winback(3);
		expect(notifications?.[0]).toMatchObject({
			metadata: { stage: "day3" },
			title: expected.title,
			body: expected.body,
		});
	});

	// =========================================================================
	// 단계별 중복 방지
	// =========================================================================

	it("이미 같은 단계를 발송했으면 스킵한다", async () => {
		const ctx = makeCtx();
		const sevenDaysAgo = dayjs.utc("2024-01-09").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: sevenDaysAgo },
		] as never);

		// 이미 day7 단계 발송 이력 (Redis)
		dedupProvider.isMember.mockResolvedValueOnce(true);

		const result = await strategy.execute(ctx);

		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	// =========================================================================
	// 오늘 WINBACK 중복 방지
	// =========================================================================

	it("오늘 이미 WINBACK을 받은 유저는 제외한다", async () => {
		const ctx = makeCtx();
		const sevenDaysAgo = dayjs.utc("2024-01-09").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: sevenDaysAgo },
		] as never);

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
	});
});

/**
 * OnboardingStrategy 전략 단위 테스트
 *
 * @description
 * OnboardingStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test onboarding.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

import { OnboardingStrategy } from "./onboarding.strategy";
import type { TimezoneContext } from "./timezone-reminder-strategy.interface";

describe("OnboardingStrategy — 온보딩 전략", () => {
	let strategy: OnboardingStrategy;
	let database: Mocked<DatabaseService>;
	let notificationService: Mocked<NotificationService>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 08:00 = UTC 2024-01-15T23:00:00Z */
	const FAKE_NOW = new Date("2024-01-15T23:00:00Z");

	const TODAY = dayjs.utc("2024-01-16").startOf("day").toDate();

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 8,
		localMinute: 0,
		dayOfWeek: 2,
		today: TODAY,
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } =
			await TestBed.solitary(OnboardingStrategy).compile();

		strategy = unit;
		database = unitRef.get(DatabaseService);
		database.userPreference.findMany.mockResolvedValue([] as never);
		notificationService = unitRef.get(NotificationService);

		// 기본 mock 설정
		database.user.findMany.mockResolvedValue([] as never);
		database.todo.groupBy.mockResolvedValue([] as never);
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue(
			undefined as never,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("Day 0 가입 유저에게 온보딩 알림을 발송한다", async () => {
		// Given: 오늘 가입한 유저가 있다
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", createdAt: TODAY },
		] as never);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 1건의 알림이 발송된다
		expect(result).toEqual({ sent: 1 });
		expect(notificationService.createAndSendBatch).toHaveBeenCalledTimes(1);

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.onboarding(0);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "SYSTEM_NOTICE",
			title: expected?.title,
			body: expected?.body,
			metadata: { onboardingDay: 0 },
		});
	});

	it("Day 5에서 completedCount가 포함된 메시지를 발송한다", async () => {
		// Given: 5일 전 가입한 유저가 있고, 완료한 todo가 3개이다
		const ctx = makeCtx();
		const fiveDaysAgo = dayjs.utc("2024-01-11").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", createdAt: fiveDaysAgo },
		] as never);

		database.todo.groupBy.mockResolvedValueOnce([
			{ userId: "user-1", _count: { id: 3 } },
		] as never);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: completedCount=3이 포함된 알림이 발송된다
		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.onboarding(5, 3);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "SYSTEM_NOTICE",
			title: expected?.title,
			body: expected?.body,
			metadata: { onboardingDay: 5 },
		});
	});

	it("Day 4에서는 알림을 발송하지 않는다", async () => {
		// Given: 4일 전 가입한 유저가 있다
		const ctx = makeCtx();
		const fourDaysAgo = dayjs.utc("2024-01-12").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", createdAt: fourDaysAgo },
		] as never);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 알림이 발송되지 않는다
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("Day 8 이상 유저는 무시한다", async () => {
		// Given: 10일 전 가입한 유저가 있다
		const ctx = makeCtx();
		const tenDaysAgo = dayjs.utc("2024-01-06").startOf("day").toDate();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", createdAt: tenDaysAgo },
		] as never);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 알림이 발송되지 않는다
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("이미 오늘 알림을 받은 유저는 스킵한다", async () => {
		// Given: 오늘 가입한 유저 2명 중 1명은 이미 알림을 받았다
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([
			{ id: "user-1", createdAt: TODAY },
			{ id: "user-2", createdAt: TODAY },
		] as never);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: user-2에게만 알림이 발송된다
		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe("user-2");
	});

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		// Given: 해당 타임존에 신규 유저가 없다
		const ctx = makeCtx();

		database.user.findMany.mockResolvedValueOnce([] as never);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 알림이 발송되지 않는다
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

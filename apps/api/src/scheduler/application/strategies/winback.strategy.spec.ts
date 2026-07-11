/**
 * WinbackStrategy 전략 단위 테스트
 *
 * @description
 * WinbackStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test winback.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";
import { NotificationFacade, NotificationMessageBuilder } from "@/notification";
import type { IDedupProvider } from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import { DEDUP_PROVIDER } from "@/shared/infrastructure/dedup/interfaces/dedup.interface";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import { WinbackStrategy } from "./winback.strategy";

describe("WinbackStrategy — 윈백 전략", () => {
	let strategy: WinbackStrategy;
	let reader: Mocked<ReEngagementReaderPort>;
	let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
	let notificationService: Mocked<NotificationFacade>;
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
		reader = unitRef.get(RE_ENGAGEMENT_READER);
		preferenceReader = unitRef.get(SCHEDULER_PREFERENCE_READER);
		notificationService = unitRef.get(NotificationFacade);
		dedupProvider = unitRef.get(DEDUP_PROVIDER);

		// pickVariant 결정론적으로 고정 (첫 번째 variant 선택)
		jest.spyOn(Math, "random").mockReturnValue(0);

		// 기본 mock 설정
		reader.findWinbackUsers.mockResolvedValue([]);
		preferenceReader.findUserLocales.mockResolvedValue(new Map());
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
		dedupProvider.isMember.mockResolvedValue(false);
		dedupProvider.addMembers.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("7일 미접속 유저에게 day7 Win-back을 발송한다", async () => {
		// Given
		const ctx = makeCtx();
		const sevenDaysAgo = dayjs.utc("2024-01-09").startOf("day").toDate();

		reader.findWinbackUsers.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: sevenDaysAgo },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
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
		// Given
		const ctx = makeCtx();
		const fourteenDaysAgo = dayjs.utc("2024-01-02").startOf("day").toDate();

		reader.findWinbackUsers.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: fourteenDaysAgo },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
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

	it("21일 미접속 유저에게 day21 Win-back을 발송한다", async () => {
		// Given
		const ctx = makeCtx();
		const twentyOneDaysAgo = dayjs.utc("2023-12-26").startOf("day").toDate();

		reader.findWinbackUsers.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: twentyOneDaysAgo },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.winback(21);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "WINBACK",
			title: expected.title,
			body: expected.body,
			metadata: { stage: "day21" },
		});
	});

	it("30일 미접속 유저에게 day30 Win-back을 발송한다", async () => {
		// Given
		const ctx = makeCtx();
		const thirtyDaysAgo = dayjs.utc("2023-12-17").startOf("day").toDate();

		reader.findWinbackUsers.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: thirtyDaysAgo },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });

		const notifications =
			notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = NotificationMessageBuilder.winback(30);
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "WINBACK",
			title: expected.title,
			body: expected.body,
			metadata: { stage: "day30" },
		});
	});

	it("3일 미접속 유저에게 day3 Win-back을 발송한다", async () => {
		// Given
		const ctx = makeCtx();
		const threeDaysAgo = dayjs.utc("2024-01-13").startOf("day").toDate();

		reader.findWinbackUsers.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: threeDaysAgo },
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
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

	it("이미 같은 단계를 발송했으면 스킵한다", async () => {
		// Given
		const ctx = makeCtx();
		const sevenDaysAgo = dayjs.utc("2024-01-09").startOf("day").toDate();

		reader.findWinbackUsers.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: sevenDaysAgo },
		]);

		// 이미 day7 단계 발송 이력 (Redis)
		dedupProvider.isMember.mockResolvedValueOnce(true);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("오늘 이미 WINBACK을 받은 유저는 제외한다", async () => {
		// Given
		const ctx = makeCtx();
		const sevenDaysAgo = dayjs.utc("2024-01-09").startOf("day").toDate();

		reader.findWinbackUsers.mockResolvedValueOnce([
			{ id: "user-1", lastActiveAt: sevenDaysAgo },
		]);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-1"]),
		);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		// Given — beforeEach 기본 설정
		const ctx = makeCtx();

		reader.findWinbackUsers.mockResolvedValueOnce([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

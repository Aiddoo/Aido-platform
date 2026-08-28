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

import {
	createOnboardingNotificationMessage,
	NotificationHistoryReader,
	NotificationPublisher,
} from "@/notification";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import { OnboardingStrategy } from "./onboarding.strategy";

describe("OnboardingStrategy — 온보딩 전략", () => {
	let strategy: OnboardingStrategy;
	let reader: Mocked<ReEngagementReaderPort>;
	let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
	let notificationPublisher: Mocked<NotificationPublisher>;
	let notificationHistoryReader: Mocked<NotificationHistoryReader>;

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

		const { unit, unitRef } = await TestBed.solitary(OnboardingStrategy).compile();

		strategy = unit;
		reader = unitRef.get(RE_ENGAGEMENT_READER);
		preferenceReader = unitRef.get(SCHEDULER_PREFERENCE_READER);
		notificationPublisher = unitRef.get(NotificationPublisher);
		notificationHistoryReader = unitRef.get(NotificationHistoryReader);

		// 기본 mock 설정
		reader.findOnboardingCandidates.mockResolvedValue([]);
		reader.countCompletedTodosByUsers.mockResolvedValue([]);
		preferenceReader.findUserLocales.mockResolvedValue(new Map());
		notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("Day 0 가입 유저에게 온보딩 알림을 발송한다", async () => {
		// Given: 오늘 가입한 유저가 있다
		const ctx = makeCtx();

		reader.findOnboardingCandidates.mockResolvedValueOnce([{ id: "user-1", createdAt: TODAY }]);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 1건의 알림이 발송된다
		expect(result).toEqual({ sent: 1 });
		expect(notificationPublisher.publishBatch).toHaveBeenCalledTimes(1);

		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		const expected = createOnboardingNotificationMessage({ day: 0 });
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

		reader.findOnboardingCandidates.mockResolvedValueOnce([
			{ id: "user-1", createdAt: fiveDaysAgo },
		]);

		reader.countCompletedTodosByUsers.mockResolvedValueOnce([{ userId: "user-1", count: 3 }]);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: completedCount=3이 포함된 알림이 발송된다
		expect(result).toEqual({ sent: 1 });

		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		const expected = createOnboardingNotificationMessage({ day: 5, completedCount: 3 });
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

		reader.findOnboardingCandidates.mockResolvedValueOnce([
			{ id: "user-1", createdAt: fourDaysAgo },
		]);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 알림이 발송되지 않는다
		expect(result).toEqual({ sent: 0 });
		expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
	});

	it("Day 8 이상 유저는 무시한다", async () => {
		// Given: 10일 전 가입한 유저가 있다
		const ctx = makeCtx();
		const tenDaysAgo = dayjs.utc("2024-01-06").startOf("day").toDate();

		reader.findOnboardingCandidates.mockResolvedValueOnce([
			{ id: "user-1", createdAt: tenDaysAgo },
		]);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 알림이 발송되지 않는다
		expect(result).toEqual({ sent: 0 });
		expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
	});

	it("이미 오늘 알림을 받은 유저는 스킵한다", async () => {
		// Given: 오늘 가입한 유저 2명 중 1명은 이미 알림을 받았다
		const ctx = makeCtx();

		reader.findOnboardingCandidates.mockResolvedValueOnce([
			{ id: "user-1", createdAt: TODAY },
			{ id: "user-2", createdAt: TODAY },
		]);

		notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: user-2에게만 알림이 발송된다
		expect(result).toEqual({ sent: 1 });

		const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe("user-2");
	});

	it("대상이 없으면 publishBatch를 호출하지 않는다", async () => {
		// Given: 해당 타임존에 신규 유저가 없다
		const ctx = makeCtx();

		reader.findOnboardingCandidates.mockResolvedValueOnce([]);

		// When: 온보딩 전략을 실행한다
		const result = await strategy.execute(ctx);

		// Then: 알림이 발송되지 않는다
		expect(result).toEqual({ sent: 0 });
		expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
	});
});

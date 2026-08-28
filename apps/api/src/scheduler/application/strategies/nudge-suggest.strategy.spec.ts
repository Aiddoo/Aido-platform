/**
 * NudgeSuggestStrategy 전략 단위 테스트
 *
 * @description
 * NudgeSuggestStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test nudge-suggest.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { createNudgeSuggestionNotificationMessage, NotificationSender } from "@/notification";

import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	RE_ENGAGEMENT_READER,
	type ReEngagementReaderPort,
} from "../ports/re-engagement-reader.port";
import { SCHEDULER_DEDUP, type SchedulerDedupPort } from "../ports/scheduler-dedup.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import { NudgeSuggestStrategy } from "./nudge-suggest.strategy";

describe("NudgeSuggestStrategy — 찔러보기 제안 전략", () => {
	let strategy: NudgeSuggestStrategy;
	let reader: Mocked<ReEngagementReaderPort>;
	let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
	let notificationService: Mocked<NotificationSender>;
	let schedulerDedup: Mocked<SchedulerDedupPort>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-16 14:00 = UTC 2024-01-16T05:00:00Z */
	const FAKE_NOW = new Date("2024-01-16T05:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 14,
		localMinute: 0,
		dayOfWeek: 2,
		today: dayjs.utc("2024-01-16").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } = await TestBed.solitary(NudgeSuggestStrategy).compile();

		strategy = unit;
		reader = unitRef.get(RE_ENGAGEMENT_READER);
		preferenceReader = unitRef.get(SCHEDULER_PREFERENCE_READER);
		notificationService = unitRef.get(NotificationSender);
		schedulerDedup = unitRef.get(SCHEDULER_DEDUP);

		// 기본 mock 설정
		reader.findActiveUsersInTimezone.mockResolvedValue([]);
		reader.findNudgeSuggestFollows.mockResolvedValue([]);
		preferenceReader.findUserLocales.mockResolvedValue(new Map());
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
		schedulerDedup.findSentNudgePairs.mockResolvedValue(new Set());
		schedulerDedup.recordNudgePairs.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("비활성 친구가 있으면 Nudge Suggest를 발송한다", async () => {
		// Given
		const ctx = makeCtx();
		const threeDaysAgo = dayjs.utc("2024-01-13").startOf("day").toDate();

		// activeUsers
		reader.findActiveUsersInTimezone.mockResolvedValue([{ id: "user-1" }]);

		// allFollows: user-1 → friend-1 (비활성 친구)
		reader.findNudgeSuggestFollows.mockResolvedValue([
			{
				followerId: "user-1",
				followingId: "friend-1",
				follower: {
					id: "user-1",
					lastActiveAt: FAKE_NOW,
					profile: { name: "사용자1" },
				},
				following: {
					id: "friend-1",
					lastActiveAt: threeDaysAgo,
					profile: { name: "친구1" },
				},
			},
		]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });

		const notifications = notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = createNudgeSuggestionNotificationMessage({
			friendName: "친구1",
			locale: "ko",
			variantContext: {
				campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
				recipientId: "user-1",
				occurrenceKey: "2024-01-16",
			},
		});
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "NUDGE_SUGGEST",
			title: expected.title,
			body: expected.body,
			campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
			variantId: expected.variantId,
			friendId: "friend-1",
		});
	});

	it("이미 이번 주 같은 친구에게 발송했으면 스킵한다", async () => {
		// Given
		const ctx = makeCtx();
		const threeDaysAgo = dayjs.utc("2024-01-13").startOf("day").toDate();

		reader.findActiveUsersInTimezone.mockResolvedValue([{ id: "user-1" }]);

		reader.findNudgeSuggestFollows.mockResolvedValue([
			{
				followerId: "user-1",
				followingId: "friend-1",
				follower: {
					id: "user-1",
					lastActiveAt: FAKE_NOW,
					profile: { name: "사용자1" },
				},
				following: {
					id: "friend-1",
					lastActiveAt: threeDaysAgo,
					profile: { name: "친구1" },
				},
			},
		]);

		// 이번 주 이미 friend-1에게 발송 이력 (Redis)
		schedulerDedup.findSentNudgePairs.mockResolvedValue(new Set(["user-1:friend-1"]));

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("친구가 없으면 Nudge Suggest를 발송하지 않는다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findActiveUsersInTimezone.mockResolvedValue([{ id: "user-1" }]);

		// 비활성 친구 없음
		reader.findNudgeSuggestFollows.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		// Given — beforeEach 기본 설정
		const ctx = makeCtx();

		reader.findActiveUsersInTimezone.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});

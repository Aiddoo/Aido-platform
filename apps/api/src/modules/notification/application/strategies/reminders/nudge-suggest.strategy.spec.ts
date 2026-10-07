import dayjs from "dayjs";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  createNudgeSuggestionNotificationMessage,
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { type ReEngagementReaderPort } from "../../ports/reminders/re-engagement-reader.port.js";
import { type SchedulerDedupPort } from "../../ports/reminders/scheduler-dedup.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import { NudgeSuggestStrategy } from "./nudge-suggest.strategy.js";

describe("NudgeSuggestStrategy — 찔러보기 제안 전략", () => {
  let strategy: NudgeSuggestStrategy;
  let reader: Mocked<ReEngagementReaderPort>;
  let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
  let notificationPublisher: Mocked<NotificationPublisher>;
  let notificationHistoryReader: Mocked<NotificationHistoryReader>;
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
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);

    const nudgeSuggestStrategyDependencies = mockDeep<
      ConstructorParameters<typeof NudgeSuggestStrategy>[0]
    >({});
    const unit = new NudgeSuggestStrategy(nudgeSuggestStrategyDependencies);

    strategy = unit;
    reader = nudgeSuggestStrategyDependencies.reader;
    preferenceReader = nudgeSuggestStrategyDependencies.preferenceReader;
    notificationPublisher = nudgeSuggestStrategyDependencies.notificationPublisher;
    notificationHistoryReader = nudgeSuggestStrategyDependencies.notificationHistoryReader;
    schedulerDedup = nudgeSuggestStrategyDependencies.schedulerDedup;

    // 기본 mock 설정
    reader.findActiveUsersInTimezone.mockResolvedValue([]);
    reader.findNudgeSuggestFollows.mockResolvedValue([]);
    preferenceReader.findUserLocales.mockResolvedValue(new Map());
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
    notificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
    schedulerDedup.findSentNudgePairs.mockResolvedValue(new Set());
    schedulerDedup.recordNudgePairs.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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

    const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
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
    expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
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
    expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
  });

  it("대상이 없으면 publishBatch를 호출하지 않는다", async () => {
    // Given — beforeEach 기본 설정
    const ctx = makeCtx();

    reader.findActiveUsersInTimezone.mockResolvedValue([]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
  });
});

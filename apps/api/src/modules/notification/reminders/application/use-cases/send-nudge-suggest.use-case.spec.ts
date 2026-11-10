import { InMemorySchedulerDedup } from "#test/doubles/notification/in-memory-scheduler-dedup";
import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReEngagementReader } from "#test/doubles/notification/stub-re-engagement.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createNudgeSuggestionNotificationMessage } from "../../../push/application/messages/notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { NudgeSuggestFollow } from "../read-models/scheduler.read-model.js";
import { SendNudgeSuggestUseCase } from "./send-nudge-suggest.use-case.js";

describe("SendNudgeSuggestUseCase — 찔러보기 제안 전략", () => {
  let reader: StubReEngagementReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let dedup: InMemorySchedulerDedup;
  let strategy: SendNudgeSuggestUseCase;

  const ctx = createTimezoneContextFixture({ date: "2024-01-16", localHour: 14 });
  // 2024-01-16의 ISO 주
  const WEEK_ID = "2024-W03";
  const sent = () => publisher.published.map(({ data }) => data);

  const follow = (
    userId: string,
    friend: { id: string; name: string | null; lastActive: string },
  ): NudgeSuggestFollow => ({
    followerId: userId,
    followingId: friend.id,
    follower: {
      id: userId,
      lastActiveAt: ctx.today.toZonedDateTime("UTC").toInstant(),
      profile: { name: "사용자1" },
    },
    following: {
      id: friend.id,
      lastActiveAt: Temporal.Instant.from(`${friend.lastActive}T00:00:00Z`),
      profile: { name: friend.name },
    },
  });

  beforeEach(() => {
    reader = new StubReEngagementReader();
    preferences = new InMemorySchedulerPreferenceReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    dedup = new InMemorySchedulerDedup();
    strategy = new SendNudgeSuggestUseCase({
      reader,
      preferenceReader: preferences,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      schedulerDedup: dedup,
      logger: new SilentLogger(),
    });
  });

  it("2~7일 쉰 맞팔 친구가 있으면 찔러보기를 제안하고 이번 주 쌍으로 기록한다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(reader.queries).toContainEqual({
      method: "findNudgeSuggestFollows",
      params: {
        candidateIds: ["user-1"],
        activeSince: Temporal.Instant.from("2024-01-09T00:00:00Z"),
        activeUntil: Temporal.Instant.from("2024-01-14T00:00:00Z"),
      },
    });
    const expected = createNudgeSuggestionNotificationMessage({
      friendName: "친구1",
      locale: "ko",
      variantContext: {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
        recipientId: "user-1",
        occurrenceKey: "2024-01-16",
      },
    });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: "user-1",
        type: "NUDGE_SUGGEST",
        title: expected.title,
        body: expected.body,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
        variantId: expected.variantId,
        friendId: "friend-1",
      }),
    ]);
    await vi.waitFor(() => {
      expect(dedup.nudgePairsOf(WEEK_ID)).toEqual(["user-1:friend-1"]);
    });
  });

  it("친구가 여럿이면 가장 오래 쉰 친구를 고른다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
      follow("user-1", { id: "friend-2", name: "친구2", lastActive: "2024-01-10" }),
    ];

    // When
    await strategy.execute(ctx);

    // Then
    expect(sent().map(({ friendId }) => friendId)).toEqual(["friend-2"]);
  });

  it("이번 주에 이미 같은 친구로 제안했으면 건너뛴다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];
    await dedup.recordNudgePairs(WEEK_ID, ["user-1:friend-1"]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("오늘 이미 제안을 받은 사용자는 제외한다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];
    history.notified("NUDGE_SUGGEST", ["user-1"], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("쉬고 있는 친구가 없으면 제안하지 않는다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1" }];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("이 시간대에 활성 사용자가 없으면 발송하지 않는다", async () => {
    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });
});

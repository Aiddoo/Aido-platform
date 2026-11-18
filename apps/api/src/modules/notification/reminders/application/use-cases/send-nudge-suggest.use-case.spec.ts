import { InMemoryNotificationDeduplication } from "#test/doubles/notification/in-memory-notification-deduplication";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReEngagementReader } from "#test/doubles/notification/stub-re-engagement.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { NotificationHistoryReader } from "../../../notifications/application/notification-history.reader.js";
import { createNudgeSuggestionNotificationMessage } from "../../../shared/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import type { NudgeSuggestFollowReadModel } from "../read-models/scheduler.read-model.js";
import { SendNudgeSuggestUseCase } from "./send-nudge-suggest.use-case.js";

describe("SendNudgeSuggestUseCase — 찔러보기 제안 전략", () => {
  let reader: StubReEngagementReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendNudgeSuggestUseCase;

  const timezoneContext = createTimezoneContextFixture({ date: "2024-01-16", localHour: 14 });
  const sent = () => publisher.published.map(({ data }) => data);

  const follow = (
    userId: string,
    friend: { id: string; name: string | null; lastActive: string },
  ): NudgeSuggestFollowReadModel => ({
    followerId: userId,
    followingId: friend.id,
    follower: {
      id: userId,
      lastActiveAt: timezoneContext.today.toZonedDateTime("UTC").toInstant(),
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
    strategy = new SendNudgeSuggestUseCase({
      reader,
      preferenceReader: preferences,
      notificationPublisher: publisher.batch,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("2~7일 쉰 맞팔 친구가 있으면 찔러보기를 제안하고 이번 ISO 주의 제안 이력을 묻는다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1", timezone: "Asia/Seoul" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(reader.queries).toContainEqual({
      method: "findNudgeSuggestFollows",
      params: {
        candidateIds: ["user-1"],
        // 서울 현지 2024-01-09 자정부터 2024-01-14 자정까지
        activeSince: Temporal.Instant.from("2024-01-08T15:00:00Z"),
        activeUntil: Temporal.Instant.from("2024-01-13T15:00:00Z"),
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
    // 2024-01-16(화)의 ISO 주는 월요일 01-15부터 다음 월요일 01-22 전까지다
    expect(
      history.nudgeSuggestionQueries.map(({ start, end }) => [start.toString(), end.toString()]),
    ).toEqual([["2024-01-15", "2024-01-22"]]);
  });

  it("친구가 여럿이면 가장 오래 쉰 친구를 고른다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1", timezone: "Asia/Seoul" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
      follow("user-1", { id: "friend-2", name: "친구2", lastActive: "2024-01-10" }),
    ];

    // When
    await strategy.execute(timezoneContext);

    // Then
    expect(sent().map(({ friendId }) => friendId)).toEqual(["friend-2"]);
  });

  it("이번 주에 이미 같은 친구로 제안했으면 건너뛴다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1", timezone: "Asia/Seoul" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];
    history.nudgeSuggested({
      userId: "user-1",
      friendId: "friend-1",
      notificationDate: Temporal.PlainDate.from("2024-01-15"),
    });

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("지난주에 같은 친구로 제안했어도 이번 주에는 다시 제안한다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1", timezone: "Asia/Seoul" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];
    history.nudgeSuggested({
      userId: "user-1",
      friendId: "friend-1",
      notificationDate: Temporal.PlainDate.from("2024-01-14"),
    });

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 1 });
  });

  it("다시 시작해 메모리가 비어도 알림 행으로 이번 주 제안을 알아 다음 날 같은 친구를 다시 제안하지 않는다", async () => {
    // Given
    const notifications = new InMemoryNotificationRepository(
      [],
      () => new Date("2024-01-16T06:00:00Z"),
    );
    const startProcess = () =>
      new SendNudgeSuggestUseCase({
        reader,
        preferenceReader: preferences,
        notificationPublisher: {
          execute: async (items) => ({
            count: (await notifications.createManyNotificationsAndReturn(items)).length,
          }),
        },
        notificationHistoryReader: new NotificationHistoryReader({
          notificationDeduplication: new InMemoryNotificationDeduplication(),
          notificationHistoryReader: notifications,
          logger: new SilentLogger(),
        }),
        logger: new SilentLogger(),
      });
    reader.activeUsers = [{ id: "user-1", timezone: "Asia/Seoul" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];
    await startProcess().execute(timezoneContext);

    // When
    const afterRestart = await startProcess().execute(
      createTimezoneContextFixture({ date: "2024-01-17", localHour: 14 }),
    );

    // Then
    expect(afterRestart).toEqual({ sent: 0 });
    expect(notifications.rows().map((row) => row.friendId)).toEqual(["friend-1"]);
  });

  it("오늘 이미 제안을 받은 사용자는 제외한다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1", timezone: "Asia/Seoul" }];
    reader.nudgeSuggestFollows = [
      follow("user-1", { id: "friend-1", name: "친구1", lastActive: "2024-01-13" }),
    ];
    history.notified("NUDGE_SUGGEST", ["user-1"], timezoneContext.today);

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("쉬고 있는 친구가 없으면 제안하지 않는다", async () => {
    // Given
    reader.activeUsers = [{ id: "user-1", timezone: "Asia/Seoul" }];

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("이 시간대에 활성 사용자가 없으면 발송하지 않는다", async () => {
    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });
});

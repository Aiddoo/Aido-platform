import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReEngagementReader } from "#test/doubles/notification/stub-re-engagement.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TEST_CUID } from "#test/fixtures/index";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createSocialDigestNotificationMessage } from "../../../push/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import { SendSocialDigestUseCase } from "./send-social-digest.use-case.js";

describe("SendSocialDigestUseCase — 소셜 다이제스트 전략", () => {
  let reader: StubReEngagementReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendSocialDigestUseCase;

  const ctx = createTimezoneContextFixture({ date: "2024-01-16", localHour: 20 });
  const VARIANT_CONTEXT = {
    campaignKey: SCHEDULER_CAMPAIGN_KEY.SOCIAL_DIGEST,
    recipientId: TEST_CUID.USER_1,
    occurrenceKey: "2024-01-16",
  } as const;
  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubReEngagementReader();
    preferences = new InMemorySchedulerPreferenceReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    strategy = new SendSocialDigestUseCase({
      reader,
      preferenceReader: preferences,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("직전 저녁 리마인더 수신자 중 본인 미완료이고 모두 끝낸 친구가 1명이면 그 친구 이름으로 보낸다", async () => {
    // Given
    reader.socialDigestCandidates = [
      { id: TEST_CUID.USER_1, todos: [{ completed: false }, { completed: true }] },
    ];
    reader.acceptedFollows = [{ followerId: TEST_CUID.USER_1, followingId: TEST_CUID.USER_2 }];
    reader.friendsWithTodayTodos = [
      {
        id: TEST_CUID.USER_2,
        profile: { name: "친구1" },
        todos: [{ completed: true }, { completed: true }],
      },
    ];

    // When
    const result = await strategy.execute(ctx, [TEST_CUID.USER_1]);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(reader.queries[0]).toEqual({
      method: "findSocialDigestCandidates",
      params: {
        timezones: ["Asia/Seoul"],
        today: ctx.today,
        tomorrow: ctx.tomorrow,
        recipientUserIds: [TEST_CUID.USER_1],
      },
    });
    const expected = createSocialDigestNotificationMessage({
      kind: "single",
      friendName: "친구1",
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: TEST_CUID.USER_1,
        type: "SOCIAL_DIGEST",
        title: expected.title,
        body: expected.body,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.SOCIAL_DIGEST,
        variantId: expected.variantId,
      }),
    ]);
  });

  it("모두 끝낸 친구가 2명 이상이면 인원 수로 보낸다", async () => {
    // Given
    reader.socialDigestCandidates = [{ id: TEST_CUID.USER_1, todos: [{ completed: false }] }];
    reader.acceptedFollows = [
      { followerId: TEST_CUID.USER_1, followingId: TEST_CUID.USER_2 },
      { followerId: TEST_CUID.USER_3, followingId: TEST_CUID.USER_1 },
    ];
    reader.friendsWithTodayTodos = [
      { id: TEST_CUID.USER_2, profile: { name: "친구1" }, todos: [{ completed: true }] },
      { id: TEST_CUID.USER_3, profile: { name: "친구2" }, todos: [{ completed: true }] },
    ];

    // When
    const result = await strategy.execute(ctx, [TEST_CUID.USER_1]);

    // Then
    expect(result).toEqual({ sent: 1 });
    const expected = createSocialDigestNotificationMessage({
      kind: "multiple",
      completedFriendCount: 2,
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("아직 다 끝내지 못한 친구는 세지 않는다", async () => {
    // Given
    reader.socialDigestCandidates = [{ id: TEST_CUID.USER_1, todos: [{ completed: false }] }];
    reader.acceptedFollows = [{ followerId: TEST_CUID.USER_1, followingId: TEST_CUID.USER_2 }];
    reader.friendsWithTodayTodos = [
      {
        id: TEST_CUID.USER_2,
        profile: { name: "친구1" },
        todos: [{ completed: true }, { completed: false }],
      },
    ];

    // When
    const result = await strategy.execute(ctx, [TEST_CUID.USER_1]);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("본인이 오늘 할 일을 모두 끝냈으면 보내지 않는다", async () => {
    // Given
    reader.socialDigestCandidates = [{ id: TEST_CUID.USER_1, todos: [{ completed: true }] }];
    reader.acceptedFollows = [{ followerId: TEST_CUID.USER_1, followingId: TEST_CUID.USER_2 }];
    reader.friendsWithTodayTodos = [
      { id: TEST_CUID.USER_2, profile: { name: "친구1" }, todos: [{ completed: true }] },
    ];

    // When
    const result = await strategy.execute(ctx, [TEST_CUID.USER_1]);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("직전 저녁 리마인더 수신자가 없으면 아무것도 조회하지 않는다", async () => {
    // Given
    reader.socialDigestCandidates = [{ id: TEST_CUID.USER_1, todos: [{ completed: false }] }];

    // When
    const result = await strategy.execute(ctx, []);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(reader.queries).toEqual([]);
  });

  it("친구가 없으면 보내지 않는다", async () => {
    // Given
    reader.socialDigestCandidates = [{ id: TEST_CUID.USER_1, todos: [{ completed: false }] }];

    // When
    const result = await strategy.execute(ctx, [TEST_CUID.USER_1]);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
    expect(reader.queriedMethods()).not.toContain("findFriendsWithTodayTodos");
  });

  it("오늘 이미 소셜 다이제스트를 받은 사용자를 제외한다", async () => {
    // Given
    reader.socialDigestCandidates = [{ id: TEST_CUID.USER_1, todos: [{ completed: false }] }];
    reader.acceptedFollows = [{ followerId: TEST_CUID.USER_1, followingId: TEST_CUID.USER_2 }];
    reader.friendsWithTodayTodos = [
      { id: TEST_CUID.USER_2, profile: { name: "친구1" }, todos: [{ completed: true }] },
    ];
    history.notified("SOCIAL_DIGEST", [TEST_CUID.USER_1], ctx.today);

    // When
    const result = await strategy.execute(ctx, [TEST_CUID.USER_1]);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("같은 날 스트릭 위기 알림을 받은 사용자는 소셜 다이제스트에서 제외한다", async () => {
    // Given
    reader.socialDigestCandidates = [{ id: TEST_CUID.USER_1, todos: [{ completed: false }] }];
    reader.acceptedFollows = [{ followerId: TEST_CUID.USER_1, followingId: TEST_CUID.USER_2 }];
    reader.friendsWithTodayTodos = [
      { id: TEST_CUID.USER_2, profile: { name: "친구1" }, todos: [{ completed: true }] },
    ];
    history.notified("STREAK_AT_RISK", [TEST_CUID.USER_1], ctx.today);

    // When
    const result = await strategy.execute(ctx, [TEST_CUID.USER_1]);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });
});

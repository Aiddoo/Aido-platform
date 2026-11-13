import { InMemorySchedulerDedup } from "#test/doubles/notification/in-memory-scheduler-dedup";
import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReEngagementReader } from "#test/doubles/notification/stub-re-engagement.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createWinbackNotificationMessage } from "../../../push/application/messages/system-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import { SendWinbackUseCase } from "./send-winback.use-case.js";

describe("SendWinbackUseCase — 윈백 전략", () => {
  let reader: StubReEngagementReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let dedup: InMemorySchedulerDedup;
  let strategy: SendWinbackUseCase;

  const ctx = createTimezoneContextFixture({ date: "2024-01-16", localHour: 12 });
  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubReEngagementReader();
    preferences = new InMemorySchedulerPreferenceReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    dedup = new InMemorySchedulerDedup();
    strategy = new SendWinbackUseCase({
      reader,
      preferenceReader: preferences,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      schedulerDedup: dedup,
      logger: new SilentLogger(),
    });
  });

  it("3~30일 미접속 구간으로 대상을 조회한다", async () => {
    // When
    await strategy.execute(ctx);

    // Then
    expect(reader.queries).toEqual([
      {
        method: "findWinbackUsers",
        params: {
          timezones: ["Asia/Seoul"],
          inactiveSince: Temporal.Instant.from("2023-12-17T00:00:00Z"),
          inactiveUntil: Temporal.Instant.from("2024-01-13T00:00:00Z"),
        },
      },
    ]);
  });

  it.each([
    { lastActive: "2024-01-13", inactiveDays: 3, stage: "day3" },
    { lastActive: "2024-01-09", inactiveDays: 7, stage: "day7" },
    { lastActive: "2024-01-02", inactiveDays: 14, stage: "day14" },
    { lastActive: "2023-12-26", inactiveDays: 21, stage: "day21" },
    { lastActive: "2023-12-17", inactiveDays: 30, stage: "day30" },
  ])(
    "$inactiveDays일 미접속 사용자에게 $stage 단계 Win-back을 보내고 그 단계를 기록한다",
    async ({ lastActive, inactiveDays, stage }) => {
      // Given
      reader.winbackUsers = [
        { id: "user-1", lastActiveAt: Temporal.Instant.from(`${lastActive}T00:00:00Z`) },
      ];

      // When
      const result = await strategy.execute(ctx);

      // Then
      expect(result).toEqual({ sent: 1 });
      const expected = createWinbackNotificationMessage({
        inactiveDays,
        locale: "ko",
        variantContext: {
          campaignKey: `${SCHEDULER_CAMPAIGN_KEY.WINBACK}.${stage}`,
          recipientId: "user-1",
          occurrenceKey: "2024-01-16",
        },
      });
      expect(sent()).toEqual([
        expect.objectContaining({
          userId: "user-1",
          type: "WINBACK",
          purpose: "ENGAGEMENT",
          title: expected.title,
          body: expected.body,
          campaignKey: SCHEDULER_CAMPAIGN_KEY.WINBACK,
          variantId: expected.variantId,
          metadata: { stage },
        }),
      ]);
      await vi.waitFor(async () => {
        expect(await dedup.hasWinbackStage("user-1", stage)).toBe(true);
      });
    },
  );

  it("저장한 언어로 보내고 지원하지 않는 언어는 영어로 보낸다", async () => {
    // Given
    reader.winbackUsers = [
      { id: "user-1", lastActiveAt: Temporal.Instant.from("2024-01-09T00:00:00Z") },
    ];
    await preferences.givenPreference({ timezone: "Asia/Seoul", locale: "fr" }, "user-1");

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createWinbackNotificationMessage({
      inactiveDays: 7,
      locale: "en",
      variantContext: {
        campaignKey: `${SCHEDULER_CAMPAIGN_KEY.WINBACK}.day7`,
        recipientId: "user-1",
        occurrenceKey: "2024-01-16",
      },
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("이미 같은 단계를 보낸 사용자는 건너뛴다", async () => {
    // Given
    reader.winbackUsers = [
      { id: "user-1", lastActiveAt: Temporal.Instant.from("2024-01-09T00:00:00Z") },
    ];
    await dedup.recordWinbackStages([{ userId: "user-1", stage: "day7" }]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("마지막 접속 기록이 없는 사용자는 단계를 정할 수 없어 보내지 않는다", async () => {
    // Given
    reader.winbackUsers = [{ id: "user-1", lastActiveAt: null }];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("오늘 이미 WINBACK을 받은 사용자는 제외한다", async () => {
    // Given
    reader.winbackUsers = [
      { id: "user-1", lastActiveAt: Temporal.Instant.from("2024-01-09T00:00:00Z") },
    ];
    history.notified("WINBACK", ["user-1"], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("대상이 없으면 발송하지 않는다", async () => {
    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });
});

import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReEngagementReader } from "#test/doubles/notification/stub-re-engagement.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createOnboardingNotificationMessage } from "../../../shared/application/messages/system-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import { SendOnboardingUseCase } from "./send-onboarding.use-case.js";

describe("SendOnboardingUseCase — 온보딩 전략", () => {
  let reader: StubReEngagementReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendOnboardingUseCase;

  const timezoneContext = createTimezoneContextFixture({ date: "2024-01-16", localHour: 8 });
  const sent = () => publisher.published.map(({ data }) => data);

  const variantContext = (day: number, recipientId = "user-1") => ({
    campaignKey: `${SCHEDULER_CAMPAIGN_KEY.ONBOARDING}.day_${day}`,
    recipientId,
    occurrenceKey: "2024-01-16",
  });

  beforeEach(() => {
    reader = new StubReEngagementReader();
    preferences = new InMemorySchedulerPreferenceReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    strategy = new SendOnboardingUseCase({
      reader,
      preferenceReader: preferences,
      notificationPublisher: publisher.batch,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("Day 0 가입 사용자에게 사용법 안내를 서비스 알림으로 보낸다", async () => {
    // Given
    reader.onboardingCandidates = [
      {
        id: "user-1",
        createdAt: timezoneContext.today.toZonedDateTime("UTC").toInstant(),
        timezone: "Asia/Seoul",
      },
    ];

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    // 사용법 안내는 서비스 알림이라 광고성 동의가 없어도 받는다
    expect(result).toEqual({ sent: 1 });
    const expected = createOnboardingNotificationMessage({
      day: 0,
      locale: "ko",
      variantContext: variantContext(0),
    });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: "user-1",
        type: "SYSTEM_NOTICE",
        purpose: "SCHEDULED_SERVICE",
        title: expected.title,
        body: expected.body,
        action: { type: "DEEP_LINK", url: "/feed" },
        metadata: { onboardingDay: 0 },
      }),
    ]);
  });

  it("가입 다음 현지 날에 Day 1 안내를 보낸다(서울 19시 가입은 UTC로 같은 날이어도 다음 날이 1일)", async () => {
    // Given
    // 2024-01-15 19:00 KST 가입, 오늘은 서울 2024-01-16
    reader.onboardingCandidates = [
      {
        id: "user-1",
        createdAt: Temporal.Instant.from("2024-01-15T10:00:00Z"),
        timezone: "Asia/Seoul",
      },
    ];

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent()).toEqual([expect.objectContaining({ metadata: { onboardingDay: 1 } })]);
  });

  it("같은 묶음이어도 사람마다 자기 시간대 달력으로 Day를 센다(런던·라고스는 지금 같은 +1이다)", async () => {
    // Given
    // 2027-03-27T23:30Z는 런던(그날 GMT)으로 27일, 라고스(+1)로 28일이다
    const createdAt = Temporal.Instant.from("2027-03-27T23:30:00Z");
    reader.onboardingCandidates = [
      { id: "user-london", createdAt, timezone: "Europe/London" },
      { id: "user-lagos", createdAt, timezone: "Africa/Lagos" },
    ];
    const context = createTimezoneContextFixture({
      date: "2027-03-29",
      timezones: ["Europe/London", "Africa/Lagos"],
    });

    // When
    await strategy.execute(context);

    // Then
    expect(sent().map(({ userId, metadata }) => [userId, metadata])).toEqual([
      ["user-london", { onboardingDay: 2 }],
      ["user-lagos", { onboardingDay: 1 }],
    ]);
  });

  it("Day 5에는 완료한 할 일 수를 담아 보낸다", async () => {
    // Given
    // 5일 전 가입, 완료한 할 일 3개
    reader.onboardingCandidates = [
      {
        id: "user-1",
        createdAt: Temporal.Instant.from("2024-01-11T00:00:00Z"),
        timezone: "Asia/Seoul",
      },
    ];
    reader.completedTodoCounts = [{ userId: "user-1", count: 3 }];

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 1 });
    const expected = createOnboardingNotificationMessage({
      day: 5,
      completedCount: 3,
      locale: "ko",
      variantContext: variantContext(5),
    });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: "user-1",
        type: "SYSTEM_NOTICE",
        title: expected.title,
        body: expected.body,
        action: { type: "DEEP_LINK", url: "/achievements" },
        metadata: { onboardingDay: 5 },
      }),
    ]);
  });

  it("완료 수가 필요 없는 날에는 완료 수를 조회하지 않는다", async () => {
    // Given
    reader.onboardingCandidates = [
      {
        id: "user-1",
        createdAt: timezoneContext.today.toZonedDateTime("UTC").toInstant(),
        timezone: "Asia/Seoul",
      },
    ];

    // When
    await strategy.execute(timezoneContext);

    // Then
    expect(reader.queriedMethods()).not.toContain("countCompletedTodosByUsers");
  });

  it("저장한 언어로 보낸다", async () => {
    // Given
    reader.onboardingCandidates = [
      {
        id: "user-1",
        createdAt: timezoneContext.today.toZonedDateTime("UTC").toInstant(),
        timezone: "Asia/Seoul",
      },
    ];
    await preferences.givenPreference({ timezone: "Asia/Seoul", locale: "en" }, "user-1");

    // When
    await strategy.execute(timezoneContext);

    // Then
    const expected = createOnboardingNotificationMessage({
      day: 0,
      locale: "en",
      variantContext: variantContext(0),
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it.each([
    { name: "Day 4", createdAt: "2024-01-12" },
    { name: "Day 8 이상", createdAt: "2024-01-06" },
  ])("$name 사용자에게는 보내지 않는다", async ({ createdAt }) => {
    // Given
    reader.onboardingCandidates = [
      {
        id: "user-1",
        createdAt: Temporal.Instant.from(`${createdAt}T00:00:00Z`),
        timezone: "Asia/Seoul",
      },
    ];

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("오늘 이미 안내를 받은 사용자는 건너뛴다", async () => {
    // Given
    reader.onboardingCandidates = [
      {
        id: "user-1",
        createdAt: timezoneContext.today.toZonedDateTime("UTC").toInstant(),
        timezone: "Asia/Seoul",
      },
      {
        id: "user-2",
        createdAt: timezoneContext.today.toZonedDateTime("UTC").toInstant(),
        timezone: "Asia/Seoul",
      },
    ];
    history.notified("SYSTEM_NOTICE", ["user-1"], timezoneContext.today);

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent().map(({ userId }) => userId)).toEqual(["user-2"]);
  });

  it("대상이 없으면 발송하지 않는다", async () => {
    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });
});

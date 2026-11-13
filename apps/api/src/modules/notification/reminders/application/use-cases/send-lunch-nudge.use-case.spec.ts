import type { SupportedLocale } from "#api/shared/domain/locale";
import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubScheduledReminderReader } from "#test/doubles/notification/stub-scheduled-reminder.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createLunchNudgeNotificationMessage } from "../../../push/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import { SendLunchNudgeUseCase } from "./send-lunch-nudge.use-case.js";

describe("SendLunchNudgeUseCase — 점심 찔러보기 전략", () => {
  let reader: StubScheduledReminderReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendLunchNudgeUseCase;

  const ctx = createTimezoneContextFixture({ date: "2024-01-16", localHour: 12, localMinute: 30 });
  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubScheduledReminderReader();
    preferences = new InMemorySchedulerPreferenceReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    strategy = new SendLunchNudgeUseCase({
      reader,
      preferenceReader: preferences,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("오늘 할 일이 있지만 하나도 끝내지 않은 사용자에게 점심 넛지를 발송한다", async () => {
    // Given
    reader.lunchNudgeUsers = [{ id: "user-1" }, { id: "user-2" }];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 2 });
    expect(reader.queries).toEqual([
      {
        method: "findLunchNudgeUsers",
        params: { timezones: ["Asia/Seoul"], today: ctx.today, tomorrow: ctx.tomorrow },
      },
    ]);
    expect(sent()).toEqual([
      expect.objectContaining({ userId: "user-1", type: "LUNCH_NUDGE", purpose: "ENGAGEMENT" }),
      expect.objectContaining({ userId: "user-2", type: "LUNCH_NUDGE", purpose: "ENGAGEMENT" }),
    ]);
  });

  it("설정이 없으면 한국어, 있으면 저장한 언어의 점심 넛지 문구와 변형을 쓴다", async () => {
    // Given
    reader.lunchNudgeUsers = [{ id: "user-1" }, { id: "user-2" }];
    await preferences.givenPreference({ timezone: "Asia/Seoul", locale: "en" }, "user-2");

    // When
    await strategy.execute(ctx);

    // Then
    const expectedFor = (recipientId: string, locale: SupportedLocale) =>
      createLunchNudgeNotificationMessage({
        locale,
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
          recipientId,
          occurrenceKey: "2024-01-16",
        },
      });
    const korean = expectedFor("user-1", "ko");
    const english = expectedFor("user-2", "en");
    expect(sent()).toEqual([
      expect.objectContaining({
        title: korean.title,
        body: korean.body,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
        variantId: korean.variantId,
      }),
      expect.objectContaining({ title: english.title, body: english.body }),
    ]);
  });

  it("오늘 이미 점심 넛지를 받은 사용자를 제외한다", async () => {
    // Given
    reader.lunchNudgeUsers = [{ id: "user-1" }, { id: "user-2" }];
    history.notified("LUNCH_NUDGE", ["user-1"], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent().map(({ userId }) => userId)).toEqual(["user-2"]);
  });

  it("모든 사용자가 이미 받았으면 발송하지 않는다", async () => {
    // Given
    reader.lunchNudgeUsers = [{ id: "user-1" }];
    history.notified("LUNCH_NUDGE", ["user-1"], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("대상이 없으면 발송 이력도 조회하지 않는다", async () => {
    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
    expect(history.queries).toEqual([]);
  });
});

import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubScheduledReminderReader } from "#test/doubles/notification/stub-scheduled-reminder.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createMonthlyReportNotificationMessage } from "../../../push/application/messages/system-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import { SendMonthlyReportUseCase } from "./send-monthly-report.use-case.js";

describe("SendMonthlyReportUseCase — 월간 리포트 전략", () => {
  let reader: StubScheduledReminderReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendMonthlyReportUseCase;

  /** 매월 1일 10:00 */
  const ctx = createTimezoneContextFixture({ date: "2024-02-01", localHour: 10 });
  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubScheduledReminderReader();
    preferences = new InMemorySchedulerPreferenceReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    strategy = new SendMonthlyReportUseCase({
      reader,
      preferenceReader: preferences,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("지난 한 달 리포트 대상(프리미엄)에게 저장한 언어로 월간 리포트를 발송한다", async () => {
    // Given
    reader.monthlyReportRecipients = [{ id: "user-1" }];
    await preferences.givenPreference({ timezone: "Asia/Seoul", locale: "en" }, "user-1");

    // When
    const result = await strategy.execute(ctx);

    // Then — AI 리포트는 유료 기능이라 대상 조회가 프리미엄만 고르고, 푸시 여부는 발송 단계가 정한다
    expect(result).toEqual({ sent: 1 });
    expect(reader.queries).toEqual([
      {
        method: "findMonthlyReportRecipients",
        params: {
          tz: "Asia/Seoul",
          periodStart: Temporal.PlainDate.from("2024-01-01"),
          periodEnd: ctx.today,
        },
      },
    ]);
    const expected = createMonthlyReportNotificationMessage({
      locale: "en",
      variantContext: {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.MONTHLY_REPORT,
        recipientId: "user-1",
        occurrenceKey: "2024-02-01",
      },
    });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: "user-1",
        type: "MONTHLY_REPORT",
        title: expected.title,
        body: expected.body,
        variantId: expected.variantId,
      }),
    ]);
  });

  it("오늘 이미 월간 리포트 알림을 받은 사용자를 제외한다", async () => {
    // Given
    reader.monthlyReportRecipients = [{ id: "user-1" }, { id: "user-2" }];
    history.notified("MONTHLY_REPORT", ["user-1"], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent().map(({ userId }) => userId)).toEqual(["user-2"]);
  });

  it("대상이 없으면 발송하지 않는다", async () => {
    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });
});

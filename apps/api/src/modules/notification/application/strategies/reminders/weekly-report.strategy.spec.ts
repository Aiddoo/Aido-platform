import dayjs from "dayjs";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  createWeeklyReportNotificationMessage,
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";

import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { type ScheduledReminderReaderPort } from "../../ports/reminders/scheduled-reminder-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import { WeeklyReportStrategy } from "./weekly-report.strategy.js";

describe("WeeklyReportStrategy — 주간 리포트 전략", () => {
  let strategy: WeeklyReportStrategy;
  let reader: Mocked<ScheduledReminderReaderPort>;
  let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
  let notificationPublisher: Mocked<NotificationPublisher>;
  let notificationHistoryReader: Mocked<NotificationHistoryReader>;

  const TZ = "Asia/Seoul";

  /** KST 2024-01-15 (월요일) 09:00 = UTC 2024-01-15T00:00:00Z */
  const FAKE_NOW = new Date("2024-01-15T00:00:00Z");

  const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
    tz: TZ,
    localHour: 9,
    localMinute: 0,
    dayOfWeek: 1,
    today: dayjs.utc("2024-01-15").startOf("day").toDate(),
    tomorrow: dayjs.utc("2024-01-16").startOf("day").toDate(),
    ...overrides,
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);

    const weeklyReportStrategyDependencies = mockDeep<
      ConstructorParameters<typeof WeeklyReportStrategy>[0]
    >({});
    const unit = new WeeklyReportStrategy(weeklyReportStrategyDependencies);

    strategy = unit;
    reader = weeklyReportStrategyDependencies.reader;
    preferenceReader = weeklyReportStrategyDependencies.preferenceReader;
    notificationPublisher = weeklyReportStrategyDependencies.notificationPublisher;
    notificationHistoryReader = weeklyReportStrategyDependencies.notificationHistoryReader;

    // 기본 mock 설정
    reader.findWeeklyReportRecipients.mockResolvedValue([]);
    preferenceReader.findUserLocales.mockResolvedValue(new Map());
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
    notificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("프리미엄 유저 전체에게 주간 리포트를 발송한다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findWeeklyReportRecipients.mockResolvedValue([{ id: "user-1" }]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });

    // AI 리포트는 유료 기능 → 프리미엄 유저만 조회 (pushEnabled 필터 없음, 푸시 전송은 PushDeliveryService가 담당)
    expect(reader.findWeeklyReportRecipients).toHaveBeenCalledTimes(1);
    expect(reader.findWeeklyReportRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ tz: TZ }),
    );

    const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
    const expected = createWeeklyReportNotificationMessage();
    expect(notifications?.[0]).toMatchObject({
      userId: "user-1",
      type: "WEEKLY_REPORT",
      title: expected.title,
      body: expected.body,
    });
  });

  it("이미 알림 받은 사용자를 제외한다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findWeeklyReportRecipients.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);

    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
    expect(notifications).toHaveLength(1);
    expect(notifications?.[0]?.userId).toBe("user-2");
  });

  it("대상이 없으면 publishBatch를 호출하지 않는다", async () => {
    // Given — beforeEach 기본 설정
    const ctx = makeCtx();

    reader.findWeeklyReportRecipients.mockResolvedValue([]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
  });
});

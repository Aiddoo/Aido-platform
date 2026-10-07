import dayjs from "dayjs";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  createLunchNudgeNotificationMessage,
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { type ScheduledReminderReaderPort } from "../../ports/reminders/scheduled-reminder-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import { LunchNudgeStrategy } from "./lunch-nudge.strategy.js";

describe("LunchNudgeStrategy — 점심 찔러보기 전략", () => {
  let strategy: LunchNudgeStrategy;
  let reader: Mocked<ScheduledReminderReaderPort>;
  let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
  let notificationPublisher: Mocked<NotificationPublisher>;
  let notificationHistoryReader: Mocked<NotificationHistoryReader>;

  const TZ = "Asia/Seoul";

  /** KST 2024-01-16 12:30 = UTC 2024-01-16T03:30:00Z */
  const FAKE_NOW = new Date("2024-01-16T03:30:00Z");

  const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
    tz: TZ,
    localHour: 12,
    localMinute: 30,
    dayOfWeek: 2,
    today: dayjs.utc("2024-01-16").startOf("day").toDate(),
    tomorrow: dayjs.utc("2024-01-17").startOf("day").toDate(),
    ...overrides,
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);

    const lunchNudgeStrategyDependencies = mockDeep<
      ConstructorParameters<typeof LunchNudgeStrategy>[0]
    >({});
    const unit = new LunchNudgeStrategy(lunchNudgeStrategyDependencies);

    strategy = unit;
    reader = lunchNudgeStrategyDependencies.reader;
    preferenceReader = lunchNudgeStrategyDependencies.preferenceReader;
    notificationPublisher = lunchNudgeStrategyDependencies.notificationPublisher;
    notificationHistoryReader = lunchNudgeStrategyDependencies.notificationHistoryReader;

    // 기본 mock 설정
    reader.findLunchNudgeUsers.mockResolvedValue([]);
    preferenceReader.findUserLocales.mockResolvedValue(new Map());
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
    notificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("오늘 할일이 있지만 완료가 0개인 유저에게 점심 넛지를 발송한다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findLunchNudgeUsers.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 2 });
    expect(notificationPublisher.publishBatch).toHaveBeenCalledTimes(1);

    const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
    expect(notifications).toHaveLength(2);
    expect(notifications?.[0]).toMatchObject({
      userId: "user-1",
      type: "LUNCH_NUDGE",
    });
    expect(notifications?.[1]).toMatchObject({
      userId: "user-2",
      type: "LUNCH_NUDGE",
    });
  });

  it("createLunchNudgeNotificationMessage() 메시지를 사용한다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findLunchNudgeUsers.mockResolvedValue([{ id: "user-1" }]);

    // When
    await strategy.execute(ctx);

    // Then
    const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
    const expected = createLunchNudgeNotificationMessage({
      locale: "ko",
      variantContext: {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
        recipientId: "user-1",
        occurrenceKey: "2024-01-16",
      },
    });
    expect(notifications?.[0]).toMatchObject({
      title: expected.title,
      body: expected.body,
      campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
      variantId: expected.variantId,
    });
  });

  it("이미 알림 받은 사용자를 제외한다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findLunchNudgeUsers.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);

    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
    expect(notifications).toHaveLength(1);
    expect(notifications?.[0]?.userId).toBe("user-2");
  });

  it("모든 유저가 이미 알림을 받았으면 발송하지 않는다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findLunchNudgeUsers.mockResolvedValue([{ id: "user-1" }]);

    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
  });

  it("대상이 없으면 publishBatch를 호출하지 않는다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findLunchNudgeUsers.mockResolvedValue([]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
    expect(notificationHistoryReader.findAlreadyNotifiedUserIds).not.toHaveBeenCalled();
  });
});

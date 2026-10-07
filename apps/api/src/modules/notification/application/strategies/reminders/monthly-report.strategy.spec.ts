import dayjs from "dayjs";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { createMonthlyReportNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { MonthlyReportStrategy } from "./monthly-report.strategy.js";

describe("MonthlyReportStrategy — 월간 리포트 전략", () => {
  let strategy: MonthlyReportStrategy;
  let reader: Mocked<ConstructorParameters<typeof MonthlyReportStrategy>[0]["reader"]>;
  let preferenceReader: Mocked<
    ConstructorParameters<typeof MonthlyReportStrategy>[0]["preferenceReader"]
  >;
  let notificationPublisher: Mocked<
    ConstructorParameters<typeof MonthlyReportStrategy>[0]["notificationPublisher"]
  >;
  let notificationHistoryReader: Mocked<
    ConstructorParameters<typeof MonthlyReportStrategy>[0]["notificationHistoryReader"]
  >;

  const TZ = "Asia/Seoul";

  /** KST 2024-02-01 (목요일) 10:00 = UTC 2024-02-01T01:00:00Z */
  const FAKE_NOW = new Date("2024-02-01T01:00:00Z");

  const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
    tz: TZ,
    localHour: 10,
    localMinute: 0,
    dayOfWeek: 4,
    today: dayjs.utc("2024-02-01").startOf("day").toDate(),
    tomorrow: dayjs.utc("2024-02-02").startOf("day").toDate(),
    ...overrides,
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FAKE_NOW);

    const monthlyReportStrategyDependencies = mockDeep<
      ConstructorParameters<typeof MonthlyReportStrategy>[0]
    >({});
    const unit = new MonthlyReportStrategy(monthlyReportStrategyDependencies);

    strategy = unit;
    reader = monthlyReportStrategyDependencies.reader;
    preferenceReader = monthlyReportStrategyDependencies.preferenceReader;
    notificationPublisher = monthlyReportStrategyDependencies.notificationPublisher;
    notificationHistoryReader = monthlyReportStrategyDependencies.notificationHistoryReader;

    // 기본 mock 설정
    reader.findMonthlyReportRecipients.mockResolvedValue([]);
    preferenceReader.findUserLocales.mockResolvedValue(new Map());
    notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
    notificationPublisher.publishBatch.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("프리미엄 유저 전체에게 월간 리포트를 발송한다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findMonthlyReportRecipients.mockResolvedValue([{ id: "user-1" }]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });

    // AI 리포트는 유료 기능 → 프리미엄 유저만 조회 (push 여부는 PushDeliveryService가 판단)
    expect(reader.findMonthlyReportRecipients).toHaveBeenCalledTimes(1);
    expect(reader.findMonthlyReportRecipients).toHaveBeenCalledWith(
      expect.objectContaining({ tz: TZ }),
    );

    const notifications = notificationPublisher.publishBatch.mock.calls[0]?.[0];
    const expected = createMonthlyReportNotificationMessage();
    expect(notifications?.[0]).toMatchObject({
      userId: "user-1",
      type: "MONTHLY_REPORT",
      title: expected.title,
      body: expected.body,
    });
  });

  it("이미 알림 받은 사용자를 제외한다", async () => {
    // Given
    const ctx = makeCtx();

    reader.findMonthlyReportRecipients.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);

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

    reader.findMonthlyReportRecipients.mockResolvedValue([]);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(notificationPublisher.publishBatch).not.toHaveBeenCalled();
  });
});

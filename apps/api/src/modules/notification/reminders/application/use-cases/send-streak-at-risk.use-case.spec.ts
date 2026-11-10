import type { SupportedLocale } from "#api/shared/domain/locale";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubReEngagementReader } from "#test/doubles/notification/stub-re-engagement.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createStreakAtRiskNotificationMessage } from "../../../push/application/messages/notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { UserWithTodosAndStreak } from "../read-models/scheduler.read-model.js";
import { SendStreakAtRiskUseCase } from "./send-streak-at-risk.use-case.js";

describe("SendStreakAtRiskUseCase — 연속 달성 위험 전략", () => {
  let reader: StubReEngagementReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendStreakAtRiskUseCase;

  const ctx = createTimezoneContextFixture({ date: "2024-01-16", localHour: 20 });
  const YESTERDAY = Temporal.PlainDate.from("2024-01-15");
  const sent = () => publisher.published.map(({ data }) => data);

  /** 어제까지 이어 왔고 오늘 미완료 1개 → 위기 */
  const atRiskUser = (id: string, streak = 5, locale = "ko"): UserWithTodosAndStreak => ({
    id,
    todos: [{ completed: false }],
    preference: { currentStreak: streak, lastCompletedDate: YESTERDAY, locale },
  });

  const expectedMessage = (recipientId: string, streak: number, locale: SupportedLocale = "ko") =>
    createStreakAtRiskNotificationMessage({
      streak,
      locale,
      variantContext: {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.STREAK_AT_RISK,
        recipientId,
        occurrenceKey: "2024-01-16",
      },
    });

  beforeEach(() => {
    reader = new StubReEngagementReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    strategy = new SendStreakAtRiskUseCase({
      reader,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("연속 3일 이상이고 오늘 미완료인 사용자에게 스트릭 위기 알림을 보낸다", async () => {
    // Given
    reader.streakAtRiskUsers = [atRiskUser("user-1", 5)];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(reader.queries).toEqual([
      {
        method: "findStreakAtRiskUsers",
        params: { tz: "Asia/Seoul", today: ctx.today, tomorrow: ctx.tomorrow },
      },
    ]);
    expect(sent()).toEqual([
      expect.objectContaining({ userId: "user-1", type: "STREAK_AT_RISK", purpose: "ENGAGEMENT" }),
    ]);
  });

  it.each([7, 10])("다시 계산한 연속 기록 %i일을 메시지에 쓴다", async (streak) => {
    // Given 어제 완료 + 오늘 미완료라 연속 기록이 그대로 이어진다
    reader.streakAtRiskUsers = [atRiskUser("user-1", streak)];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = expectedMessage("user-1", streak);
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("지원하지 않는 언어로 저장한 사용자는 영어로 받는다", async () => {
    // Given
    reader.streakAtRiskUsers = [atRiskUser("user-1", 5, "de")];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = expectedMessage("user-1", 5, "en");
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("연속 기록이 3일보다 짧으면 보내지 않는다", async () => {
    // Given
    reader.streakAtRiskUsers = [atRiskUser("user-1", 2)];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("오늘 할 일을 모두 끝낸 사용자는 제외한다", async () => {
    // Given
    reader.streakAtRiskUsers = [
      {
        id: "user-completed",
        todos: [{ completed: true }, { completed: true }],
        preference: { currentStreak: 5, lastCompletedDate: YESTERDAY, locale: "ko" },
      },
    ];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("마지막 완료일이 없어 연속 기록이 위기가 아니면 제외한다", async () => {
    // Given
    reader.streakAtRiskUsers = [
      {
        id: "user-1",
        todos: [{ completed: false }],
        preference: { currentStreak: 5, lastCompletedDate: null, locale: "ko" },
      },
    ];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("오늘 이미 스트릭 위기 알림을 받은 사용자를 제외한다", async () => {
    // Given
    reader.streakAtRiskUsers = [atRiskUser("user-1"), atRiskUser("user-2")];
    history.notified("STREAK_AT_RISK", ["user-1"], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent().map(({ userId }) => userId)).toEqual(["user-2"]);
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

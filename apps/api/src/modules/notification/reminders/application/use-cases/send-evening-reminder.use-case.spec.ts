import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubScheduledReminderReader } from "#test/doubles/notification/stub-scheduled-reminder.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TEST_CUID } from "#test/fixtures/index";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createEveningReminderNotificationMessage } from "../../../push/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import type { EveningReminderUser } from "../read-models/scheduler.read-model.js";
import { SendEveningReminderUseCase } from "./send-evening-reminder.use-case.js";

describe("SendEveningReminderUseCase — 저녁 리마인더 전략", () => {
  let reader: StubScheduledReminderReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendEveningReminderUseCase;

  const VARIANT_CONTEXT = {
    campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
    recipientId: TEST_CUID.USER_1,
    occurrenceKey: "2024-01-16",
  } as const;

  const makeCtx = (overrides: Partial<TimezoneContext> = {}): TimezoneContext =>
    createTimezoneContextFixture({ date: "2024-01-16", localHour: 18, ...overrides });

  const user = (
    id: string,
    todos: readonly boolean[],
    preference: Partial<NonNullable<EveningReminderUser["preference"]>> = {},
  ): EveningReminderUser => ({
    id,
    timezone: "Asia/Seoul",
    todos: todos.map((completed) => ({ completed })),
    preference: { currentStreak: 0, lastCompletedDate: null, locale: "ko", ...preference },
  });

  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubScheduledReminderReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    strategy = new SendEveningReminderUseCase({
      reader,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("프리미엄 사용자에게 고른 시각에 저녁 리마인더를 발송하고 무료 사용자는 조회하지 않는다", async () => {
    // Given
    const ctx = makeCtx({ localHour: 20, localMinute: 30 });
    reader.premiumEveningUsers = [user(TEST_CUID.USER_1, [true, false])];
    reader.freeEveningUsers = [user(TEST_CUID.USER_2, [false])];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({
      sent: 1,
      recipients: [{ userId: TEST_CUID.USER_1, timezone: "Asia/Seoul" }],
    });
    expect(reader.queries).toEqual([
      {
        method: "findPremiumEveningReminderUsers",
        params: expect.objectContaining({ timezones: ["Asia/Seoul"], hour: 20, minute: 30 }),
      },
    ]);
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: TEST_CUID.USER_1,
        type: "EVENING_REMINDER",
        notificationDate: ctx.today,
      }),
    ]);
  });

  it("무료 사용자에게는 19:00에 저녁 리마인더를 발송한다", async () => {
    // Given
    const ctx = makeCtx({ localHour: 19, localMinute: 0 });
    reader.freeEveningUsers = [user(TEST_CUID.USER_2, [false])];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({
      sent: 1,
      recipients: [{ userId: TEST_CUID.USER_2, timezone: "Asia/Seoul" }],
    });
    expect(reader.queriedMethods()).toEqual([
      "findPremiumEveningReminderUsers",
      "findFreeEveningReminderUsers",
    ]);
  });

  it("특정 사용자만 다시 보는 catch-up에서는 19:00이어도 무료 사용자를 조회하지 않는다", async () => {
    // Given
    const ctx = makeCtx({ localHour: 19, localMinute: 0, userId: TEST_CUID.USER_1 });
    reader.freeEveningUsers = [user(TEST_CUID.USER_2, [false])];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0, recipients: [] });
    expect(reader.queriedMethods()).toEqual(["findPremiumEveningReminderUsers"]);
  });

  it("어제 완료하고 오늘도 전체 완료한 사용자는 이어진 연속 기록으로 완료 메시지를 받는다", async () => {
    // Given 어제(2024-01-15)까지 5일 연속 → 오늘 완료로 6일
    const ctx = makeCtx();
    reader.premiumEveningUsers = [
      user(TEST_CUID.USER_1, [true, true], {
        currentStreak: 5,
        lastCompletedDate: Temporal.PlainDate.from("2024-01-15"),
      }),
    ];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createEveningReminderNotificationMessage({
      completed: 2,
      total: 2,
      streak: 6,
      isStreakAtRisk: false,
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: TEST_CUID.USER_1,
        title: expected.title,
        body: expected.body,
      }),
    ]);
  });

  it("전체 완료 시 완료 메시지를 발송한다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumEveningUsers = [user(TEST_CUID.USER_1, [true, true])];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createEveningReminderNotificationMessage({
      completed: 2,
      total: 2,
      streak: 1,
      isStreakAtRisk: false,
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({
      title: expected.title,
      body: expected.body,
      campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
      variantId: expected.variantId,
    });
  });

  it("일부 완료 시 남은 개수 메시지를 발송한다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumEveningUsers = [user(TEST_CUID.USER_1, [true, false, false])];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createEveningReminderNotificationMessage({
      completed: 1,
      total: 3,
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("하나도 안 했을 때 해당 메시지를 발송한다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumEveningUsers = [user(TEST_CUID.USER_1, [false, false])];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createEveningReminderNotificationMessage({
      completed: 0,
      total: 2,
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("저장한 언어가 지원하지 않는 언어면 영어로 보낸다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumEveningUsers = [user(TEST_CUID.USER_1, [false, false], { locale: "fr" })];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createEveningReminderNotificationMessage({
      completed: 0,
      total: 2,
      locale: "en",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("오늘 이미 저녁 리마인더를 받은 사용자를 제외한다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumEveningUsers = [user(TEST_CUID.USER_1, [false]), user(TEST_CUID.USER_2, [false])];
    history.notified("EVENING_REMINDER", [TEST_CUID.USER_1], ctx.today);
    history.notified("MORNING_REMINDER", [TEST_CUID.USER_2], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({
      sent: 1,
      recipients: [{ userId: TEST_CUID.USER_2, timezone: "Asia/Seoul" }],
    });
    expect(sent().map(({ userId }) => userId)).toEqual([TEST_CUID.USER_2]);
  });

  it("대상이 없으면 발송하지 않는다", async () => {
    // Given
    const ctx = makeCtx();

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0, recipients: [] });
    expect(publisher.published).toEqual([]);
  });
});

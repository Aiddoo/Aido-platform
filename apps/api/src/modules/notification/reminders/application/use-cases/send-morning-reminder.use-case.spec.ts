import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { StubScheduledReminderReader } from "#test/doubles/notification/stub-scheduled-reminder.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TEST_CUID } from "#test/fixtures/index";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import {
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
} from "../../../push/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { SendMorningReminderUseCase } from "./send-morning-reminder.use-case.js";

describe("SendMorningReminderUseCase — 아침 리마인더 전략", () => {
  let reader: StubScheduledReminderReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let strategy: SendMorningReminderUseCase;

  const VARIANT_CONTEXT = {
    campaignKey: SCHEDULER_CAMPAIGN_KEY.MORNING_REMINDER,
    recipientId: TEST_CUID.USER_1,
    occurrenceKey: "2024-01-16",
  } as const;

  const makeCtx = (overrides: Partial<TimezoneContext> = {}): TimezoneContext =>
    createTimezoneContextFixture({ date: "2024-01-16", localHour: 8, ...overrides });

  const sent = () => publisher.published.map(({ data }) => data);

  beforeEach(() => {
    reader = new StubScheduledReminderReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    strategy = new SendMorningReminderUseCase({
      reader,
      notificationPublisher: publisher,
      notificationHistoryReader: history,
      logger: new SilentLogger(),
    });
  });

  it("프리미엄 사용자에게 고른 시각에 아침 리마인더를 발송한다", async () => {
    // Given
    const ctx = makeCtx({ localHour: 9, localMinute: 30 });
    reader.premiumMorningUsers = [{ id: TEST_CUID.USER_1, preference: null, _count: { todos: 3 } }];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(reader.queries[0]?.params).toMatchObject({ tz: "Asia/Seoul", hour: 9, minute: 30 });
    expect(sent()).toEqual([
      expect.objectContaining({
        userId: TEST_CUID.USER_1,
        type: "MORNING_REMINDER",
        notificationDate: ctx.today,
      }),
    ]);
  });

  it("무료 사용자에게는 08:00에 아침 리마인더를 발송한다", async () => {
    // Given
    const ctx = makeCtx({ localHour: 8, localMinute: 0 });
    reader.freeMorningUsers = [{ id: TEST_CUID.USER_2, preference: null, _count: { todos: 2 } }];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(reader.queriedMethods()).toEqual([
      "findPremiumMorningReminderUsers",
      "findFreeMorningReminderUsers",
    ]);
    expect(sent().map(({ userId }) => userId)).toEqual([TEST_CUID.USER_2]);
  });

  it("무료 사용자는 08:00이 아니면 조회하지도 보내지도 않는다", async () => {
    // Given
    const ctx = makeCtx({ localHour: 9, localMinute: 30 });
    reader.freeMorningUsers = [{ id: TEST_CUID.USER_2, preference: null, _count: { todos: 2 } }];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(reader.queriedMethods()).toEqual(["findPremiumMorningReminderUsers"]);
  });

  it("특정 사용자만 다시 보는 catch-up에서는 08:00이어도 무료 사용자를 조회하지 않는다", async () => {
    // Given
    const ctx = makeCtx({ localHour: 8, localMinute: 0, userId: TEST_CUID.USER_1 });
    reader.freeMorningUsers = [{ id: TEST_CUID.USER_2, preference: null, _count: { todos: 2 } }];

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(reader.queries).toEqual([
      {
        method: "findPremiumMorningReminderUsers",
        params: expect.objectContaining({ userId: UserId.reconstitute(TEST_CUID.USER_1) }),
      },
    ]);
  });

  it("할 일이 있는 사용자에게 개수를 담은 아침 메시지를 발송한다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumMorningUsers = [{ id: TEST_CUID.USER_1, preference: null, _count: { todos: 5 } }];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createMorningReminderNotificationMessage({
      count: 5,
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("할 일이 없는 사용자에게 할 일 없음 메시지를 발송한다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumMorningUsers = [{ id: TEST_CUID.USER_1, preference: null, _count: { todos: 0 } }];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createMorningNoTodoNotificationMessage({
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("저장한 언어로 보내고 지원하지 않는 언어는 영어로 보낸다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumMorningUsers = [
      { id: TEST_CUID.USER_1, preference: { locale: "ja" }, _count: { todos: 5 } },
    ];

    // When
    await strategy.execute(ctx);

    // Then
    const expected = createMorningReminderNotificationMessage({
      count: 5,
      locale: "en",
      variantContext: VARIANT_CONTEXT,
    });
    expect(sent()[0]).toMatchObject({ title: expected.title, body: expected.body });
  });

  it("오늘 이미 아침 리마인더를 받은 사용자를 제외한다", async () => {
    // Given
    const ctx = makeCtx();
    reader.premiumMorningUsers = [
      { id: TEST_CUID.USER_1, preference: null, _count: { todos: 3 } },
      { id: TEST_CUID.USER_2, preference: null, _count: { todos: 2 } },
    ];
    history.notified("MORNING_REMINDER", [TEST_CUID.USER_1], ctx.today);

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 1 });
    expect(sent().map(({ userId }) => userId)).toEqual([TEST_CUID.USER_2]);
  });

  it("대상이 없으면 발송하지 않는다", async () => {
    // Given
    const ctx = makeCtx();

    // When
    const result = await strategy.execute(ctx);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });
});

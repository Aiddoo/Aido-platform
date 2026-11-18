import { SUPPORTED_LOCALES } from "@aido/api/vocabulary";

import { previousIsoWeekOf } from "#api/modules/notification/reminders/domain/reminder-day.domain-service";
import type {
  WeeklyStatsTodoSeed,
  WeeklyStatsUserSeed,
} from "#test/contracts/notification/weekly-achievement-stats-reader.contract";
import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";
import { InMemoryWeeklyAchievementStatsReader } from "#test/doubles/notification/in-memory-weekly-achievement-stats.reader";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { RecordingWeeklyAchievementWriter } from "#test/doubles/notification/recording-weekly-achievement-writer";
import { StubNotificationHistoryReader } from "#test/doubles/notification/stub-notification-history.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTimezoneContextFixture } from "#test/fixtures/notification/timezone-context.fixture";

import { createWeeklyAchievementNotificationMessage } from "../../../shared/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import { SendWeeklyAchievementUseCase } from "./send-weekly-achievement.use-case.js";

describe("SendWeeklyAchievementUseCase — 주간 성취 전략", () => {
  let stats: InMemoryWeeklyAchievementStatsReader;
  let preferences: InMemorySchedulerPreferenceReader;
  let publisher: RecordingNotificationPublisher;
  let history: StubNotificationHistoryReader;
  let writer: RecordingWeeklyAchievementWriter;
  let strategy: SendWeeklyAchievementUseCase;

  /** 월요일 07:00 실행 → 지난주 2024-01-08(월)~2024-01-14(일) 집계 */
  const timezoneContext = createTimezoneContextFixture({ date: "2024-01-15", localHour: 7 });
  const sent = () => publisher.published.map(({ data }) => data);

  /** 지난주 수요일 하루짜리 할 일 total개 중 completed개를 끝냈다 */
  const lastWeekTodos = (total: number, completed: number): WeeklyStatsTodoSeed[] =>
    Array.from({ length: total }, (_, index) => ({
      start: "2024-01-10",
      end: null,
      completed: index < completed,
    }));

  const givenUser = (
    userId: string,
    todos: readonly WeeklyStatsTodoSeed[],
    plan: WeeklyStatsUserSeed["plan"] = "FREE",
  ) => stats.givenUser({ timezone: "Asia/Seoul", plan, todos }, userId);

  beforeEach(() => {
    stats = new InMemoryWeeklyAchievementStatsReader();
    preferences = new InMemorySchedulerPreferenceReader();
    publisher = new RecordingNotificationPublisher();
    history = new StubNotificationHistoryReader();
    writer = new RecordingWeeklyAchievementWriter();
    strategy = new SendWeeklyAchievementUseCase({
      reader: stats,
      preferenceReader: preferences,
      notificationPublisher: publisher.batch,
      notificationHistoryReader: history,
      weeklyAchievementWriter: writer,
      logger: new SilentLogger(),
    });
  });

  it("지난주 월~일 범위의 할 일만 집계하고 그 주의 ISO 연·주차로 기록한다", async () => {
    // Given
    // 지난주 3개(2개 완료)와 이번 주 월요일에 끝낸 1개
    await givenUser("user-1", [
      ...lastWeekTodos(3, 2),
      { start: "2024-01-15", end: null, completed: true },
    ]);

    // When
    await strategy.execute(timezoneContext);

    // Then
    const { isoYear, isoWeek } = previousIsoWeekOf(timezoneContext.today);
    expect(writer.writes).toEqual([
      [
        {
          userId: "user-1",
          year: isoYear,
          week: isoWeek,
          totalTodos: 3,
          completedTodos: 2,
          achievedAt: timezoneContext.today,
        },
      ],
    ]);
  });

  it("주간 달성 푸시는 무료 사용자에게만 보내고 프리미엄 기록은 저장만 한다", async () => {
    // Given
    await givenUser("free-user", lastWeekTodos(3, 2));
    await givenUser("premium-user", lastWeekTodos(3, 3), "PREMIUM");

    // When
    await strategy.execute(timezoneContext);

    // Then
    expect(writer.records.map(({ userId }) => userId).toSorted()).toEqual([
      "free-user",
      "premium-user",
    ]);
    expect(sent().map(({ userId }) => userId)).toEqual(["free-user"]);
  });

  it("완료한 할 일이 있는 모든 무료 사용자에게 완료·전체 개수를 담아 보낸다", async () => {
    // Given
    await givenUser("user-1", lastWeekTodos(5, 4));
    await givenUser("user-2", lastWeekTodos(3, 2));
    await preferences.givenPreference({ timezone: "Asia/Seoul", locale: "en" }, "user-2");

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 2 });
    const expectedFor = (recipientId: string, completedCount: number, totalCount: number) =>
      createWeeklyAchievementNotificationMessage({
        completedCount,
        totalCount,
        locale: recipientId === "user-2" ? "en" : "ko",
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.WEEKLY_ACHIEVEMENT,
          recipientId,
          occurrenceKey: "2024-01-15",
        },
      });
    const first = expectedFor("user-1", 4, 5);
    const second = expectedFor("user-2", 2, 3);
    expect(sent().toSorted((left, right) => left.userId.localeCompare(right.userId))).toEqual([
      expect.objectContaining({
        userId: "user-1",
        type: "WEEKLY_ACHIEVEMENT",
        purpose: "SCHEDULED_SERVICE",
        title: first.title,
        body: first.body,
      }),
      expect.objectContaining({ userId: "user-2", title: second.title, body: second.body }),
    ]);
  });

  it("하나도 끝내지 못한 주도 기록은 저장하고 알림은 보내지 않는다", async () => {
    // Given
    await givenUser("user-1", lastWeekTodos(5, 0));

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(writer.records).toEqual([
      expect.objectContaining({ userId: "user-1", totalTodos: 5, completedTodos: 0 }),
    ]);
    expect(result).toEqual({ sent: 0 });
    expect(publisher.published).toEqual([]);
  });

  it("이미 알림을 받은 사용자는 알림만 거르고 기록은 그대로 저장한다", async () => {
    // Given
    await givenUser("user-1", lastWeekTodos(3, 2));
    await givenUser("user-2", lastWeekTodos(4, 3));
    history.notified("WEEKLY_ACHIEVEMENT", ["user-1"], timezoneContext.today);

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(writer.records.map(({ userId }) => userId).toSorted()).toEqual(["user-1", "user-2"]);
    expect(result).toEqual({ sent: 1 });
    expect(sent().map(({ userId }) => userId)).toEqual(["user-2"]);
  });

  it("지난주 할 일이 없으면 기록도 알림도 남기지 않는다", async () => {
    // Given
    // 이번 주 할 일만 있다
    await givenUser("user-1", [{ start: "2024-01-15", end: null, completed: true }]);

    // When
    const result = await strategy.execute(timezoneContext);

    // Then
    expect(result).toEqual({ sent: 0 });
    expect(writer.writes).toEqual([]);
    expect(publisher.published).toEqual([]);
  });
});

type WeeklyAchievementStrategyDependencies = ConstructorParameters<
  typeof SendWeeklyAchievementUseCase
>[0];
type WeeklyStatsQuery = Parameters<
  WeeklyAchievementStrategyDependencies["reader"]["groupTotalTodosByUser"]
>[0];
type WeeklyAchievementRecords = Parameters<
  WeeklyAchievementStrategyDependencies["weeklyAchievementWriter"]["execute"]
>[0]["records"];
type PublishedBatch = Parameters<
  WeeklyAchievementStrategyDependencies["notificationPublisher"]["execute"]
>[0];

describe.each(SUPPORTED_LOCALES)("%s 주간 성취 문구의 기간", (locale) => {
  it("월요일 실제 전략의 이전 주 집계를 이번 주 성과로 안내하지 않는다", async () => {
    // Given
    const userId = "synthetic-notification-user";
    const totalQueries: WeeklyStatsQuery[] = [];
    const writtenRecords: WeeklyAchievementRecords[] = [];
    const publishedBatches: PublishedBatch[] = [];
    const dependencies: WeeklyAchievementStrategyDependencies = {
      reader: {
        groupTotalTodosByUser: async (query) => {
          totalQueries.push(query);
          return [{ userId, count: 8 }];
        },
        groupCompletedTodosByUser: async () => [{ userId, count: 3 }],
        findFreeRecipientIds: async () => new Set([userId]),
      },
      preferenceReader: { getUserLocales: async () => () => locale },
      notificationHistoryReader: { findAlreadyNotifiedUserIds: async () => new Set() },
      weeklyAchievementWriter: {
        execute: async (input) => {
          writtenRecords.push(input.records);
        },
      },
      notificationPublisher: {
        execute: async (notifications) => {
          publishedBatches.push(notifications);
          return { count: notifications.length };
        },
      },
      logger: new SilentLogger(),
    };
    const strategy = new SendWeeklyAchievementUseCase(dependencies);
    const context: TimezoneContext = {
      timezones: ["Asia/Seoul"],
      localHour: 7,
      localMinute: 0,
      reminderTimes: [{ hour: 7, minute: 0 }],
      dayOfWeek: 1,
      today: Temporal.PlainDate.from("2026-07-27"),
      tomorrow: Temporal.PlainDate.from("2026-07-28"),
    };
    // When
    await strategy.execute(context);
    const params = totalQueries[0];
    const record = writtenRecords[0]?.[0];
    const message = publishedBatches[0]?.[0];

    // Then
    expect(params?.periodStart.toString()).toBe("2026-07-20");
    expect(params?.periodEnd.toString()).toBe("2026-07-27");
    expect(record).toMatchObject({ year: 2026, week: 30, totalTodos: 8, completedTodos: 3 });
    expect(message).toBeDefined();
    const text = `${message?.title} ${message?.body}`;
    expect(text).toMatch(locale === "ko" ? /지난주/ : /last week/i);
  });
});

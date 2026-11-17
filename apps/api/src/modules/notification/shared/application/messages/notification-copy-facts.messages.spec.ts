import { describe, it, expect, vi } from "vitest";

import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import type { SupportedLocale } from "#api/shared/domain/locale";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { SendWeeklyAchievementUseCase } from "../../../reminders/application/use-cases/send-weekly-achievement.use-case.js";
import type { TimezoneContext } from "../../../reminders/domain/timezone-context.read-model.js";
import { SOCIAL_COPY } from "./notification-copy-templates.messages.js";
import {
  createEveningReminderNotificationMessage,
  createMorningReminderNotificationMessage,
  createStreakAtRiskNotificationMessage,
  createWeeklyAchievementNotificationMessage,
} from "./scheduler-notification.messages.js";
import { getNotificationFriendFallback } from "./social-notification.messages.js";
import {
  createOnboardingNotificationMessage,
  createWeeklyReportNotificationMessage,
  createMonthlyReportNotificationMessage,
} from "./system-notification.messages.js";

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
  WeeklyAchievementStrategyDependencies["notificationPublisher"]["publishBatch"]
>[0];

const locales: SupportedLocale[] = ["ko", "en"];
const today = Temporal.PlainDate.from("2026-07-27");
const yesterday = Temporal.PlainDate.from("2026-07-26");
const totalCompletionClaim = /모두|every\s+(?:planned\s+)?to-do|all\s+(?:done|complete)/i;

describe.each(locales)("%s 알림 문구와 실제 정책의 사실 조건", (locale) => {
  it.each(["evening", "standalone"])(
    "%s는 미완료 3개일 때 하나만 완료하면 스트릭 유지라고 약속하지 않는다",
    (kind) => {
      // Given
      const before = computeEffectiveStreak({
        currentStreak: 5,
        lastCompletedDate: yesterday,
        todosCompleted: 0,
        todosTotal: 3,
        today,
      });
      const afterOne = computeEffectiveStreak({
        currentStreak: 5,
        lastCompletedDate: yesterday,
        todosCompleted: 1,
        todosTotal: 3,
        today,
      });

      // When
      const message =
        kind === "evening"
          ? createEveningReminderNotificationMessage({
              completed: 0,
              total: 3,
              streak: before.streak,
              isStreakAtRisk: before.isAtRisk,
              locale,
            })
          : createStreakAtRiskNotificationMessage({ streak: before.streak, locale });

      // Then
      expect(before.isAtRisk).toBe(true);
      expect(afterOne.isAtRisk).toBe(true);
      expect(afterOne.streak).toBe(5);
      expect(message.body).toMatch(
        locale === "ko" ? /목록.*남은|남은.*목록/ : /list.*left|left.*list/i,
      );
    },
  );

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
      preferenceReader: { findUserLocales: async () => new Map([[userId, locale]]) },
      notificationHistoryReader: { findAlreadyNotifiedUserIds: async () => new Set() },
      weeklyAchievementWriter: {
        execute: async (input) => {
          writtenRecords.push(input.records);
        },
      },
      notificationPublisher: {
        publishBatch: async (notifications) => {
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
      dayOfWeek: 1,
      today: Temporal.PlainDate.from("2026-07-27"),
      tomorrow: Temporal.PlainDate.from("2026-07-28"),
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-26T22:00:00.000Z"));
    try {
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
    } finally {
      vi.useRealTimers();
    }
  });

  it("249/250 완료가 반올림 100%라도 모든 할 일을 완료했다고 말하지 않는다", () => {
    // Given
    const completedCount = 249;
    const totalCount = 250;

    // When
    const message = createWeeklyAchievementNotificationMessage({
      completedCount,
      totalCount,
      locale,
    });

    // Then
    expect(completedCount).toBeLessThan(totalCount);
    expect(Math.round((completedCount / totalCount) * 100)).toBe(100);
    expect(message.title).toContain("99%");
    expect(`${message.title} ${message.body}`).not.toMatch(totalCompletionClaim);
  });

  it("실제 250/250 전체 완료에는 모두 완료라는 문구를 허용한다", () => {
    // When
    const message = createWeeklyAchievementNotificationMessage({
      completedCount: 250,
      totalCount: 250,
      locale,
    });

    // Then
    expect(`${message.title} ${message.body}`).toMatch(totalCompletionClaim);
  });
});

it("실제로 남은 일이 한 개이면 하나 완료 뒤 스트릭이 이어진다", () => {
  // When
  const before = computeEffectiveStreak({
    currentStreak: 5,
    lastCompletedDate: yesterday,
    todosCompleted: 2,
    todosTotal: 3,
    today,
  });
  const afterOne = computeEffectiveStreak({
    currentStreak: 5,
    lastCompletedDate: yesterday,
    todosCompleted: 3,
    todosTotal: 3,
    today,
  });

  // Then
  expect(before.isAtRisk).toBe(true);
  expect(afterOne.isAtRisk).toBe(false);
  expect(afterOne.streak).toBe(6);
});

describe("완료 수와 기간을 실제 입력으로 안내한다", () => {
  it.each(locales)("%s 완료가 0개인 가입 5일차에는 다음 목록을 안내한다", (locale) => {
    // Given
    const completedCount = 0;

    // When
    const message = createOnboardingNotificationMessage({ day: 5, completedCount, locale });

    // Then
    // 기록된 완료가 없는 경우 완료가 쌓인다는 설명을 만들지 않는다
    expect(message.body).toMatch(locale === "ko" ? /목록.*다음/ : /next.*list/i);
  });

  it.each([1, 2])("영어 완료/할 일 %d개의 단복수를 구분한다", (count) => {
    // Given
    const expectedNoun = count === 1 ? "1 to-do" : "2 to-dos";
    // When
    const morning = createMorningReminderNotificationMessage({ count, locale: "en" });
    const onboarding = createOnboardingNotificationMessage({
      day: 5,
      completedCount: count,
      locale: "en",
    });
    // Then
    expect(morning.title).toBe(`${expectedNoun} today ☀️`);
    expect(onboarding.title).toBe(`${expectedNoun} done so far`);
  });

  it.each(locales)(
    "%s 이전 기간 리포트는 생성 완료를 전제하지 않고 확인 화면을 안내한다",
    (locale) => {
      // When
      const weekly = createWeeklyReportNotificationMessage({ locale });
      const monthly = createMonthlyReportNotificationMessage({ locale });

      // Then
      expect(`${weekly.title} ${weekly.body}`).toMatch(locale === "ko" ? /지난주/ : /last week/i);
      expect(`${monthly.title} ${monthly.body}`).toMatch(
        locale === "ko" ? /지난달/ : /last month/i,
      );
      expect(weekly.body).toMatch(locale === "ko" ? /리포트.*살펴봐/ : /explore.*Reports/i);
      expect(monthly.body).toMatch(locale === "ko" ? /리포트.*살펴봐/ : /explore.*Reports/i);
    },
  );

  it.each([
    ["민재", "민재님과"],
    ["민준", "민준님과"],
    ["친구", "친구와"],
  ])("닉네임 %s에는 님을 붙이고 이름을 모르는 친구에는 붙이지 않는다", (senderName, expected) => {
    // When
    const message = SOCIAL_COPY.FOLLOW_ACCEPTED.render("v2", { senderName }, "ko");

    // Then
    expect(message?.title).toBe(`${expected} 친구가 됐어요 🎉`);
  });

  it("영어는 이름을 모르는 친구를 문장 중간에서 your friend로 부른다", () => {
    // Given
    const friendName = getNotificationFriendFallback("en");
    // When
    const message = SOCIAL_COPY.NUDGE_SUGGEST.render("v1", { friendName }, "en");
    // Then
    expect(message?.title).toBe("Check in on your friend?");
  });
});

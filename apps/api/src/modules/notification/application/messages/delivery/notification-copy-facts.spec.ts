import { describe, it, expect, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import type { SupportedLocale } from "#api/shared/domain/locale";

import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { WeeklyAchievementStrategy } from "../../strategies/reminders/weekly-achievement.strategy.js";
import * as ko from "./locales/ko.js";
import { createMorningReminderNotificationMessage } from "./scheduler-notification-message.js";
import {
  createEveningReminderNotificationMessage,
  createStreakAtRiskNotificationMessage,
  createWeeklyAchievementNotificationMessage,
} from "./scheduler-notification-message.js";
import {
  createOnboardingNotificationMessage,
  createWeeklyReportNotificationMessage,
  createMonthlyReportNotificationMessage,
} from "./system-notification-message.js";

const locales: SupportedLocale[] = ["ko", "en"];
const today = new Date("2026-07-27T00:00:00.000Z");
const yesterday = new Date("2026-07-26T00:00:00.000Z");
const totalCompletionClaim = /모두|every\s+(?:planned\s+)?to-do|all\s+(?:done|complete)/i;

describe.each(locales)("%s 알림 문구와 실제 정책의 사실 조건", (locale) => {
  it.each(["evening", "standalone"])(
    "%s는 미완료 3개일 때 하나만 완료하면 스트릭 유지라고 약속하지 않는다",
    (kind) => {
      // Given - 어제까지 5일 기록, 오늘 3개 중 완료 0개
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
      // When - 실제 정책 값을 실제 메시지 factory에 전달
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
      // Then - 한 개 완료 뒤에도 실제 정책은 위험 상태. 문구가 그 반대를 약속하면 안 된다
      expect(before.isAtRisk).toBe(true);
      expect(afterOne.isAtRisk).toBe(true);
      expect(afterOne.streak).toBe(5);
      expect(message.body).toMatch(
        locale === "ko" ? /목록.*남은|남은.*목록/ : /list.*left|left.*list/i,
      );
    },
  );

  it("월요일 실제 전략의 이전 주 집계를 이번 주 성과로 안내하지 않는다", async () => {
    // Given - KST 7/27 월요일, 지난주 전체8/완료3; 외부 I/O는 typed port 대역
    const dependencies = mockDeep<ConstructorParameters<typeof WeeklyAchievementStrategy>[0]>();
    const userId = "synthetic-notification-user";
    dependencies.reader.groupTotalTodosByUser.mockResolvedValue([{ userId, count: 8 }]);
    dependencies.reader.groupCompletedTodosByUser.mockResolvedValue([{ userId, count: 3 }]);
    dependencies.reader.findFreeRecipientIds.mockResolvedValue(new Set([userId]));
    dependencies.preferenceReader.findUserLocales.mockResolvedValue(new Map([[userId, locale]]));
    dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
    dependencies.weeklyAchievementWriter.execute.mockResolvedValue(undefined);
    dependencies.notificationPublisher.publishBatch.mockResolvedValue({ count: 1 });
    const strategy = new WeeklyAchievementStrategy(dependencies);
    const context: TimezoneContext = {
      tz: "Asia/Seoul",
      localHour: 7,
      localMinute: 0,
      dayOfWeek: 1,
      today,
      tomorrow: new Date("2026-07-28T00:00:00.000Z"),
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-26T22:00:00.000Z"));
    try {
      // When - 실제 집계 범위와 factory/campaign 변형 선택을 실행
      await strategy.execute(context);
      const params = dependencies.reader.groupTotalTodosByUser.mock.calls[0]?.[0];
      const record = dependencies.weeklyAchievementWriter.execute.mock.calls[0]?.[0].records[0];
      const message = dependencies.notificationPublisher.publishBatch.mock.calls[0]?.[0][0];
      // Then - 실제 조회/저장은 이전 주인데 문장은 이번 주라고 말하면 안 된다
      expect(params?.periodStart.toISOString()).toBe("2026-07-20T00:00:00.000Z");
      expect(params?.periodEnd.toISOString()).toBe("2026-07-27T00:00:00.000Z");
      expect(record).toMatchObject({ year: 2026, week: 30, totalTodos: 8, completedTodos: 3 });
      expect(message).toBeDefined();
      const text = `${message?.title} ${message?.body}`;
      expect(text).toMatch(locale === "ko" ? /지난주/ : /last week/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("249/250 완료가 반올림 100%라도 모든 할 일을 완료했다고 말하지 않는다", () => {
    // Given - 미완료 1개가 실제로 남음
    const completedCount = 249;
    const totalCount = 250;
    // When - 설치된 실제 factory의 분기/renderer를 사용
    const message = createWeeklyAchievementNotificationMessage({
      completedCount,
      totalCount,
      locale,
    });
    // Then - 반올림 표시는 전체 완료의 증거가 아니다
    expect(completedCount).toBeLessThan(totalCount);
    expect(Math.round((completedCount / totalCount) * 100)).toBe(100);
    expect(message.title).toContain("99%");
    expect(`${message.title} ${message.body}`).not.toMatch(totalCompletionClaim);
  });

  it("실제 250/250 전체 완료에는 모두 완료라는 문구를 허용한다", () => {
    // Given / When - 실제 미완료 0개
    const message = createWeeklyAchievementNotificationMessage({
      completedCount: 250,
      totalCount: 250,
      locale,
    });
    // Then - 모든 완료 문구 자체를 금지하는 검사가 아니다
    expect(`${message.title} ${message.body}`).toMatch(totalCompletionClaim);
  });
});

it("실제로 남은 일이 한 개이면 하나 완료 뒤 스트릭이 이어진다", () => {
  // Given / When - 오늘 3개 중 이미2개 완료, 남은1개를 완료
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
  // Then - 실제 조건이 충족된 경우는 별도로 보존한다
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
    // Then - 기록된 완료가 없는 경우 완료가 쌓인다는 설명을 만들지 않는다
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
    expect(onboarding.title).toBe(`${expectedNoun} finished`);
  });

  it.each(locales)(
    "%s 이전 기간 리포트는 생성 완료를 전제하지 않고 확인 화면을 안내한다",
    (locale) => {
      // Given - 이 입력에는 report READY 상태가 없다
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
    ["민재", "민재와"],
    ["민준", "민준과"],
  ])("닉네임 %s를 보존하면서 친구 수락 조사를 맞춘다", (senderName, expected) => {
    // Given / When
    const message = ko.SOCIAL_TEMPLATES.FOLLOW_ACCEPTED.variants[1]({ senderName });
    // Then
    expect(message.title).toContain(`${expected} 친구가 됐어`);
  });
});

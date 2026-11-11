import {
  isAutomatedEngagementNotification,
  isGeneralRateLimitExemptNotification,
  isMarketingNotification,
  isNightExemptNotification,
} from "./push-eligibility.domain-service.js";

describe("Push 발송 대상 판단 정책", () => {
  it.each([
    "AI_SUGGESTION",
    "WINBACK",
    "SOCIAL_DIGEST",
    "NUDGE_SUGGEST",
    "LUNCH_NUDGE",
    "STREAK_AT_RISK",
  ] as const)("%s는 별도 광고성 푸시 동의가 필요한 참여 유도 알림이다", (type) => {
    expect(isMarketingNotification(type)).toBe(true);
    expect(isAutomatedEngagementNotification(type)).toBe(true);
  });

  it.each([
    "FOLLOW_NEW",
    "FOLLOW_ACCEPTED",
    "NUDGE_RECEIVED",
    "CHEER_RECEIVED",
    "TODO_REMINDER",
    "TODO_SHARED",
    "MORNING_REMINDER",
    "EVENING_REMINDER",
    "WEEKLY_REPORT",
  ] as const)("%s 서비스 알림은 별도 광고성 푸시 동의를 요구하지 않는다", (type) => {
    expect(isMarketingNotification(type)).toBe(false);
    expect(isAutomatedEngagementNotification(type)).toBe(false);
  });

  it.each([
    "TODO_REMINDER",
    "MORNING_REMINDER",
    "EVENING_REMINDER",
    "WEATHER_MORNING",
    "WEATHER_EVENING",
  ] as const)("사용자가 시각을 정한 %s는 광고성이 아니며 야간 설정 예외다", (type) => {
    expect(isMarketingNotification(type)).toBe(false);
    expect(isNightExemptNotification(type)).toBe(true);
  });

  it.each(["STREAK_AT_RISK", "WINBACK", "FOLLOW_NEW", "CHEER_RECEIVED", "SYSTEM_NOTICE"] as const)(
    "광고성·소셜·재방문·공지 %s는 21:00~08:00 예외가 아니다",
    (type) => {
      expect(isNightExemptNotification(type)).toBe(false);
    },
  );

  it.each([
    ["TODO_REMINDER", true],
    ["MORNING_REMINDER", false],
    ["FOLLOW_NEW", false],
    ["CHEER_RECEIVED", false],
    ["LUNCH_NUDGE", false],
    ["WINBACK", false],
  ] as const)(
    "사용자가 시각을 정한 할 일 리마인더만 일반 시간당 한도에서 빠진다(%s → %s)",
    (type, exempt) => {
      // When
      const result = isGeneralRateLimitExemptNotification(type);
      // Then
      expect(result).toBe(exempt);
    },
  );
});

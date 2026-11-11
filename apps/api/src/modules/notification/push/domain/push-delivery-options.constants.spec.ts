import { pushDeliveryOptions } from "./push-delivery-options.constants.js";

const HOUR_SECONDS = 3600;

describe("pushDeliveryOptions — 알림 종류별 보관 시간", () => {
  it.each([
    ["TODO_REMINDER", 1],
    ["MORNING_REMINDER", 2],
    ["EVENING_REMINDER", 2],
    ["WEATHER_MORNING", 2],
    ["WEATHER_EVENING", 2],
    ["LUNCH_NUDGE", 3],
    ["STREAK_AT_RISK", 3],
    ["SOCIAL_DIGEST", 3],
    ["DAILY_COMPLETE", 3],
    ["CHEER_RECEIVED", 12],
    ["FOLLOW_NEW", 12],
    ["TODO_SHARED", 12],
    ["WINBACK", 24],
    ["AI_SUGGESTION", 24],
    ["ADMIN_BROADCAST", 24],
    ["PREMIUM_TRIAL_ENDING", 24],
  ] as const)("%s는 꺼진 기기에 %i시간까지만 보관한다", (type, hours) => {
    // Given
    const expectedTtlSeconds = hours * HOUR_SECONDS;

    // When
    const options = pushDeliveryOptions(type);

    // Then
    expect(options).toEqual({ ttlSeconds: expectedTtlSeconds, priority: "high" });
  });
});

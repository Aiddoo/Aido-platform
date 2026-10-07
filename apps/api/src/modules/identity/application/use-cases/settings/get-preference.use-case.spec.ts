import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";

import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { GetPreference } from "./get-preference.use-case.js";

describe("GetPreference — 원본 캐시와 요청 시점의 프리미엄 게이팅", () => {
  it("같은 원본 캐시에서도 구독 변경을 즉시 반영하고 저장된 시간·다른 필드를 보존한다", async () => {
    // Given
    const fixture = createUserSettingsFixture({
      preference: {
        morningReminderHour: 7,
        morningReminderMinute: 30,
        eveningReminderHour: 20,
        eveningReminderMinute: 45,
        timezone: "Asia/Tokyo",
        locale: "ja",
        timeFormat: "TWENTY_FOUR_HOUR",
      },
    });
    const useCase = new GetPreference(fixture);
    // When
    const free = await useCase.execute({ userId: fixture.userId });
    fixture.preferenceRepository.records.delete(fixture.userId);
    fixture.entitlement.premiumUserIds.add(fixture.userId);
    const premium = await useCase.execute({ userId: fixture.userId });
    fixture.entitlement.premiumUserIds.delete(fixture.userId);
    const expired = await useCase.execute({ userId: fixture.userId });
    // Then
    expect(free).toMatchObject({
      morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
      eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
      timezone: "Asia/Tokyo",
      timeFormat: "TWENTY_FOUR_HOUR",
    });
    expect(premium).toMatchObject({
      morningReminderHour: 7,
      morningReminderMinute: 30,
      eveningReminderHour: 20,
      eveningReminderMinute: 45,
      timezone: "Asia/Tokyo",
    });
    expect(expired).toEqual(free);
    expect(fixture.preferenceRepository.reads).toEqual([fixture.userId]);
    expect(fixture.cache.snapshots.get(fixture.userId)).toMatchObject({
      morningReminderHour: 7,
      locale: "ja",
    });
    expect(premium).not.toHaveProperty("locale");
  });
  it("행이 없으면 응답 기본값을 반환하고 조회만으로 설정이나 동의를 생성하지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture({ preference: null, consent: null, premium: true });
    // When
    const result = await new GetPreference(fixture).execute({ userId: fixture.userId });
    // Then
    expect(result).toMatchObject({
      pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
      nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
      timezone: USER_PREFERENCE_DEFAULTS.TIMEZONE,
      morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
      eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
      weatherMorningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
      weatherEveningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_MINUTE,
    });
    expect(fixture.preferenceRepository.records.size).toBe(0);
    expect(fixture.consentRepository.records.size).toBe(0);
  });
});

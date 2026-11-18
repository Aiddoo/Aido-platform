import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  DEFAULT_USER_PREFERENCE_SETTINGS,
  UserPreference,
  type UserPreferencePrimitives,
} from "./user-preference.aggregate.js";

const yesterday = Temporal.PlainDate.from("2026-12-31");
const today = Temporal.PlainDate.from("2027-01-01");
const NOW = Temporal.Instant.from("2027-01-01T09:00:00Z");

function loaded(overrides: Partial<UserPreferencePrimitives> = {}): UserPreference {
  return UserPreference.reconstitute({
    userId: "user-1",
    settings: DEFAULT_USER_PREFERENCE_SETTINGS,
    streak: { currentStreak: 2, longestStreak: 4, lastCompletedDate: yesterday },
    consent: {
      userId: "user-1",
      termsAgreedAt: NOW,
      privacyAgreedAt: NOW,
      agreedTermsVersion: "1.0",
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
      aiDataSharingAgreedAt: null,
      aiDataSharingVersion: null,
    },
    ...overrides,
  });
}

describe("UserPreference — 설정·동의·연속 완료 전이와 바뀐 칸", () => {
  it("연말 다음 날 새해 완료도 연속 완료로 이어 가고 바뀐 칸은 연속 완료뿐이다", () => {
    // Given
    const preference = loaded();

    // When
    const changed = preference.recordAllTodosCompleted(today);

    // Then
    expect(changed).toBe(true);
    expect(preference.hasReachedStreakMilestone()).toBe(true);
    expect(preference.changesSinceLoad()).toEqual({
      settings: {},
      streak: {
        loaded: { currentStreak: 2, longestStreak: 4, lastCompletedDate: yesterday },
        next: { currentStreak: 3, longestStreak: 4, lastCompletedDate: today },
      },
      consent: {},
    });
  });

  it("설정 변경은 준 칸 중 달라진 칸만 바꾸고 모두 같으면 false다", () => {
    // Given
    const preference = loaded();

    // When
    const same = preference.changeSettings({ pushEnabled: true, timezone: undefined });
    const changed = preference.changeSettings({ pushEnabled: false, morningReminderMinute: 0 });

    // Then
    expect({ same, changed }).toEqual({ same: false, changed: true });
    expect(preference.changesSinceLoad()).toEqual({
      settings: { pushEnabled: false },
      streak: null,
      consent: {},
    });
  });

  it("설정 행이 없는 옛 사용자는 같은 값으로 바꿔도 행을 만들 칸 전체를 주고 연속 완료를 세지 않는다", () => {
    // Given
    const preference = loaded({ settings: null, streak: null });

    // When
    const changed = preference.changeTimezone(DEFAULT_USER_PREFERENCE_SETTINGS.timezone);
    const counted = preference.recordAllTodosCompleted(today);

    // Then
    expect({ changed, counted }).toEqual({ changed: true, counted: false });
    expect(preference.changesSinceLoad().settings).toEqual(DEFAULT_USER_PREFERENCE_SETTINGS);
  });

  it("광고성 수신은 다시 동의하면 동의 시각을 지금으로 바꾸고 이미 철회했으면 false다", () => {
    // Given
    const preference = loaded();
    const later = NOW.add({ minutes: 1 });

    // When
    const withdrawnAgain = preference.changeMarketingConsent(false, NOW);
    const agreed = preference.changeMarketingConsent(true, NOW);
    const agreedAgain = preference.changeMarketingConsent(true, later);

    // Then
    expect({ withdrawnAgain, agreed, agreedAgain }).toEqual({
      withdrawnAgain: false,
      agreed: true,
      agreedAgain: true,
    });
    expect(preference.changesSinceLoad().consent).toEqual({ marketingAgreedAt: later });
  });

  it("가입으로 만든 설정은 새것이고 받은 동의만 채운다", () => {
    // When
    const preference = UserPreference.create({
      userId: UserId.reconstitute("user-2"),
      consent: { termsAgreedAt: NOW },
    });

    // Then
    expect(preference.isNew()).toBe(true);
    expect(preference.toPrimitives()).toMatchObject({
      settings: DEFAULT_USER_PREFERENCE_SETTINGS,
      streak: { currentStreak: 0, longestStreak: 0, lastCompletedDate: null },
      consent: { termsAgreedAt: NOW, marketingAgreedAt: null },
    });
  });
});

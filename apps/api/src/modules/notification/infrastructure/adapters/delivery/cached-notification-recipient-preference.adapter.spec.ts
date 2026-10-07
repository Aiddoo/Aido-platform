import { UserPreferenceReader } from "#api/modules/identity/application/services/settings/user-preference-reader.service";
import type { PreferenceSnapshot } from "#api/modules/identity/identity-settings.public";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";
import { createUserNotificationSettingsMock } from "#test/mocks/ports/notification.mock";

import { CachedNotificationRecipientPreferenceAdapter } from "./cached-notification-recipient-preference.adapter.js";

describe("CachedNotificationRecipientPreferenceAdapter - 수신자 언어와 공유 설정 조회", () => {
  function createFixture() {
    const settings = createUserSettingsFixture({ preference: { locale: "en", currentStreak: 17 } });
    const userSettings = createUserNotificationSettingsMock();
    const preferenceReader = new UserPreferenceReader(settings);
    const reader = new CachedNotificationRecipientPreferenceAdapter(userSettings, preferenceReader);
    return { ...settings, userSettings, reader };
  }

  it("공유 캐시에는 알림·REST 설정만 저장하고 streak 상태를 포함하지 않는다", async () => {
    // Given
    const fixture = createFixture();

    // When
    const preference = await fixture.reader.getPreference(fixture.userId);
    const cached = fixture.cache.snapshots.get(fixture.userId);

    // Then
    expect(preference.locale).toBe("en");
    expect(cached).toEqual(preference);
    expect(cached).not.toHaveProperty("currentStreak");
    expect(cached).not.toHaveProperty("lastCompletedDate");
    expect(fixture.userSettings.getPreferenceRecord).not.toHaveBeenCalled();
  });

  it("설정이 없는 사용자는 저장된 기본 설정 없이 기본 언어로 조회한다", async () => {
    // Given
    const settings = createUserSettingsFixture({ preference: null });
    const reader = new CachedNotificationRecipientPreferenceAdapter(
      createUserNotificationSettingsMock(),
      new UserPreferenceReader(settings),
    );

    // When
    const preference = await reader.getPreference(settings.userId);

    // Then
    expect(preference).toMatchObject({
      pushEnabled: false,
      nightPushEnabled: false,
      timezone: "UTC",
      locale: "ko",
    });
    expect(settings.preferenceRepository.records.has(settings.userId)).toBe(false);
  });

  it("locale이 없는 기존 캐시는 DB 조회 없이 한국어로 읽는다", async () => {
    // Given
    const fixture = createFixture();
    const preference = await fixture.reader.getPreference(fixture.userId);
    const snapshot: PreferenceSnapshot = { ...preference };
    delete snapshot.locale;
    fixture.cache.snapshots.set(fixture.userId, snapshot);
    fixture.preferenceRepository.records.clear();

    // When
    const locale = await fixture.reader.getLocale(fixture.userId);

    // Then
    expect(locale).toBe("ko");
    expect(fixture.cache.snapshots.get(fixture.userId)).toEqual(snapshot);
  });

  it.each([
    ["ko", "ko"],
    ["en", "en"],
    ["fr", "ko"],
  ])("저장 언어 %s를 지원 언어 %s로 읽는다", async (storedLocale, expectedLocale) => {
    // Given
    const fixture = createFixture();
    await fixture.preferenceRepository.upsertLocale(fixture.userId, storedLocale);

    // When
    const locale = await fixture.reader.getLocale(fixture.userId);

    // Then
    expect(locale).toBe(expectedLocale);
  });

  it("중복 수신자를 제거해 한 번의 batch 조회로 언어를 읽고 없는 설정은 한국어로 채운다", async () => {
    // Given
    const fixture = createFixture();
    vi.mocked(fixture.userSettings.getPreferenceRecordsByUserIds).mockResolvedValue([
      { ...fixture.preference, userId: "english" },
    ]);

    // When
    const locales = await fixture.reader.getLocales(["english", "legacy", "english"]);

    // Then
    expect(locales).toEqual(
      new Map([
        ["english", "en"],
        ["legacy", "ko"],
      ]),
    );
    expect(fixture.userSettings.getPreferenceRecordsByUserIds).toHaveBeenCalledExactlyOnceWith([
      "english",
      "legacy",
    ]);
    expect(fixture.userSettings.getPreferenceRecord).not.toHaveBeenCalled();
  });

  it("수신자가 없으면 batch 저장소를 조회하지 않는다", async () => {
    // Given
    const fixture = createFixture();

    // When
    const locales = await fixture.reader.getLocales([]);

    // Then
    expect(locales.size).toBe(0);
    expect(fixture.userSettings.getPreferenceRecordsByUserIds).not.toHaveBeenCalled();
  });
});

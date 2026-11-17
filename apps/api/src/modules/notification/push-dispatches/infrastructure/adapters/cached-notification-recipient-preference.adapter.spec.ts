import { ReadUserPreferencesUseCase } from "#api/modules/identity/user-preferences/application/use-cases/read-user-preferences.use-case";
import type { PreferenceSettingsReadModel } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import {
  type NotificationDeliveryPreference,
  type NotificationMarketingConsent,
  UserNotificationSettingsPort,
} from "../../../shared/application/ports/user-notification-settings.port.js";
import { CachedNotificationRecipientPreferenceAdapter } from "./cached-notification-recipient-preference.adapter.js";

type PreferenceRow = NotificationDeliveryPreference & { readonly userId: string };

// 저장된 설정 행을 돌려주고 단건·batch 조회 요청을 남긴다
class StubUserNotificationSettings extends UserNotificationSettingsPort {
  readonly preferenceRows: PreferenceRow[] = [];
  readonly singleRequests: string[] = [];
  readonly batchRequests: string[][] = [];

  async upsertPushTimezone(): Promise<void> {}

  async upsertPushLocale(): Promise<void> {}

  async findPreferenceReadModel(user: UserId): Promise<NotificationDeliveryPreference | null> {
    const userId = user.value;
    this.singleRequests.push(userId);
    return this.preferenceRows.find((row) => row.userId === userId) ?? null;
  }

  async findPreferenceReadModelsByUserIds(users: readonly UserId[]): Promise<PreferenceRow[]> {
    const userIds = users.map((user) => user.value);
    this.batchRequests.push([...userIds]);
    return this.preferenceRows.filter((row) => userIds.includes(row.userId));
  }

  async findConsentReadModel(): Promise<NotificationMarketingConsent | null> {
    return null;
  }

  async findConsentReadModelsByUserIds(): Promise<
    (NotificationMarketingConsent & { readonly userId: string })[]
  > {
    return [];
  }

  async updateMarketingPushConsent(): Promise<void> {}
}

describe("CachedNotificationRecipientPreferenceAdapter - 수신자 언어와 공유 설정 조회", () => {
  function createFixture() {
    const settings = createUserSettingsFixture({ preference: { locale: "en", currentStreak: 17 } });
    const userSettings = new StubUserNotificationSettings();
    const preferenceReader = new ReadUserPreferencesUseCase(settings);
    const reader = new CachedNotificationRecipientPreferenceAdapter(userSettings, preferenceReader);
    return { ...settings, userSettings, reader };
  }

  it("공유 캐시에는 알림·REST 설정만 저장하고 streak 상태를 포함하지 않는다", async () => {
    // Given
    const fixture = createFixture();

    // When
    const preference = await fixture.reader.getPreference(UserId.reconstitute(fixture.userId));
    const cached = fixture.cache.snapshots.get(fixture.userId);

    // Then
    expect(preference.locale).toBe("en");
    expect(cached).toEqual(preference);
    expect(cached).not.toHaveProperty("currentStreak");
    expect(cached).not.toHaveProperty("lastCompletedDate");
    expect(fixture.userSettings.singleRequests).toEqual([]);
  });

  it("설정이 없는 사용자는 저장된 기본 설정 없이 기본 언어로 조회한다", async () => {
    // Given
    const settings = createUserSettingsFixture({ preference: null });
    const reader = new CachedNotificationRecipientPreferenceAdapter(
      new StubUserNotificationSettings(),
      new ReadUserPreferencesUseCase(settings),
    );

    // When
    const preference = await reader.getPreference(UserId.reconstitute(settings.userId));

    // Then
    expect(preference).toMatchObject({
      pushEnabled: true,
      nightPushEnabled: true,
      timezone: "UTC",
      locale: "ko",
    });
    expect(settings.preferenceRepository.stored(settings.userId)).toBeUndefined();
  });

  it("locale이 없는 기존 캐시는 DB 조회 없이 한국어로 읽는다", async () => {
    // Given
    const fixture = createFixture();
    const preference = await fixture.reader.getPreference(UserId.reconstitute(fixture.userId));
    const snapshot: PreferenceSettingsReadModel = { ...preference };
    delete snapshot.locale;
    fixture.cache.snapshots.set(fixture.userId, snapshot);

    // When
    const locale = await fixture.reader.getLocale(UserId.reconstitute(fixture.userId));

    // Then
    expect(locale).toBe("ko");
    expect(fixture.cache.snapshots.get(fixture.userId)).toEqual(snapshot);
  });

  it.each([
    ["ko", "ko"],
    ["en", "en"],
    // 지원하지 않는 언어는 앱처럼 영어로 보낸다
    ["fr", "en"],
  ])("저장 언어 %s를 지원 언어 %s로 읽는다", async (storedLocale, expectedLocale) => {
    // Given
    const fixture = createFixture();
    const preference = await fixture.preferenceRepository.getByUserId(
      UserId.reconstitute(fixture.userId),
    );
    preference.changeLocale(storedLocale);
    await fixture.preferenceRepository.save(preference);

    // When
    const locale = await fixture.reader.getLocale(UserId.reconstitute(fixture.userId));

    // Then
    expect(locale).toBe(expectedLocale);
  });

  it("중복 수신자를 제거해 한 번의 batch 조회로 언어를 읽고 없는 설정은 한국어로 채운다", async () => {
    // Given
    const fixture = createFixture();
    fixture.userSettings.preferenceRows.push({
      ...fixture.preference,
      userId: "english",
      locale: "en",
    });

    // When
    const localeOf = await fixture.reader.getLocales([
      UserId.reconstitute("english"),
      UserId.reconstitute("legacy"),
      UserId.reconstitute("english"),
    ]);

    // Then
    expect(["english", "legacy"].map(localeOf)).toEqual(["en", "ko"]);
    expect(fixture.userSettings.batchRequests).toEqual([["english", "legacy"]]);
    expect(fixture.userSettings.singleRequests).toEqual([]);
  });

  it("수신자가 없으면 batch 저장소를 조회하지 않는다", async () => {
    // Given
    const fixture = createFixture();

    // When
    await fixture.reader.getLocales([]);

    // Then
    expect(fixture.userSettings.batchRequests).toEqual([]);
  });
});

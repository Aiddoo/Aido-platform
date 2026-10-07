import { vi } from "vitest";

import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";

import { UpsertPushLocale } from "./upsert-push-locale.use-case.js";

describe("UpsertPushLocale — 푸시 언어 저장 경계", () => {
  it.each(["ko", "en-US"])(
    "%s locale를 저장하면서 timezone·알림·streak 설정을 보존한다",
    async (locale) => {
      // Given
      const fixture = createUserSettingsFixture({
        preference: { timezone: "Asia/Tokyo", currentStreak: 3 },
      });
      await fixture.preferenceReader.read(fixture.userId);
      // When
      await new UpsertPushLocale(fixture).execute({ userId: fixture.userId, locale });
      // Then
      expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual({
        ...fixture.preference,
        locale,
      });
      expect(fixture.cache.snapshots.has(fixture.userId)).toBe(false);
      expect((await fixture.preferenceReader.read(fixture.userId)).locale).toBe(locale);
    },
  );
  it("저장 실패는 전달하고 기존 locale 캐시를 무효화하지 않는다", async () => {
    // Given
    const fixture = createUserSettingsFixture();
    await fixture.preferenceReader.read(fixture.userId);
    const cached = fixture.cache.snapshots.get(fixture.userId);
    const storageError = new Error("locale 저장 실패");
    vi.spyOn(fixture.preferenceRepository, "upsertLocale").mockRejectedValueOnce(storageError);
    // When
    const pending = new UpsertPushLocale(fixture).execute({ userId: fixture.userId, locale: "ja" });
    // Then
    await expect(pending).rejects.toBe(storageError);
    expect(fixture.cache.snapshots.get(fixture.userId)).toEqual(cached);
    expect(fixture.preferenceRepository.records.get(fixture.userId)).toEqual(fixture.preference);
  });
});

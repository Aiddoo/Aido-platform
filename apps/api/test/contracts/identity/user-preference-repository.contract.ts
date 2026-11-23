import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";

import type { UserPreferenceRepositoryPort } from "#api/modules/identity/user-preferences/application/ports/user-preference.repository.port";
import type { UserPreferenceReadModel } from "#api/modules/identity/user-preferences/application/read-models/preference.read-model";
import type { ConsentAgreement } from "#api/modules/identity/user-preferences/domain/user-consent.entity";
import {
  DEFAULT_USER_PREFERENCE_SETTINGS,
  UserPreference,
} from "#api/modules/identity/user-preferences/domain/user-preference.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  USER_SETTINGS_FIXTURE_NOW,
  USER_SETTINGS_FIXTURE_OTHER_USER_ID,
  USER_SETTINGS_FIXTURE_USER_ID,
} from "#test/fixtures/identity/user-settings.fixture";

const USER = UserId.reconstitute(USER_SETTINGS_FIXTURE_USER_ID);
const OTHER_USER = UserId.reconstitute(USER_SETTINGS_FIXTURE_OTHER_USER_ID);
const NOW = USER_SETTINGS_FIXTURE_NOW;
const TODAY = Temporal.PlainDate.from("2026-11-10");
const YESTERDAY = TODAY.subtract({ days: 1 });

// UserPreference 테이블의 열 기본값과 같다
const COLUMN_DEFAULTS: Omit<UserPreferenceReadModel, "userId"> = {
  ...DEFAULT_USER_PREFERENCE_SETTINGS,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
};

export function describeUserPreferenceRepositoryContract(
  createRepository: () => Promise<UserPreferenceRepositoryPort>,
): void {
  async function seed(
    repository: UserPreferenceRepositoryPort,
    userId: UserId,
    consent: ConsentAgreement = {},
  ): Promise<void> {
    await repository.save(UserPreference.create({ userId, consent }));
  }

  // 어제까지 연속 완료가 1인 사용자를 만든다
  async function seedWithStreak(repository: UserPreferenceRepositoryPort): Promise<void> {
    await seed(repository, USER);
    const preference = await repository.getByUserId(USER);
    preference.recordAllTodosCompleted(YESTERDAY);
    await repository.save(preference);
  }

  describe("사용자 설정 저장소 계약", () => {
    it("설정·동의 행이 없으면 기본값으로 읽고 읽기 모델은 null이다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const preference = await repository.getByUserId(USER);
      const readModel = await repository.findReadModelByUserId(USER);

      // Then
      expect(preference.toPrimitives()).toMatchObject({
        settings: null,
        streak: null,
        consent: { termsAgreedAt: null, marketingAgreedAt: null, aiDataSharingVersion: null },
      });
      expect(preference.settings).toEqual(DEFAULT_USER_PREFERENCE_SETTINGS);
      expect(readModel).toBeNull();
    });

    it("가입 저장은 기본 설정과 받은 동의로 두 행을 만들고 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      await seed(repository, USER, { termsAgreedAt: NOW, agreedTermsVersion: "2.0" });
      const readModel = await repository.findReadModelByUserId(USER);
      const preference = await repository.getByUserId(USER);

      // Then
      expect(readModel).toEqual({ ...COLUMN_DEFAULTS, userId: USER.value });
      expect(preference.consent.toPrimitives()).toMatchObject({
        termsAgreedAt: NOW,
        agreedTermsVersion: "2.0",
        marketingAgreedAt: null,
      });
    });

    it("설정 행이 없는 사용자의 설정 변경은 기본값 위에 행을 만들고 동의 행은 만들지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const preference = await repository.getByUserId(USER);

      // When
      const changed = preference.changeTimezone(DEFAULT_USER_PREFERENCE_SETTINGS.timezone);
      await repository.save(preference);

      // Then
      expect(changed).toBe(true);
      expect(await repository.findReadModelByUserId(USER)).toEqual({
        ...COLUMN_DEFAULTS,
        userId: USER.value,
      });
      expect((await repository.getByUserId(USER)).consent.toPrimitives()).toMatchObject({
        termsAgreedAt: null,
      });
    });

    it("설정 변경은 준 칸(false·0 포함)만 바꾸고 다른 칸과 연속 완료는 둔다", async () => {
      // Given
      const repository = await createRepository();
      await seedWithStreak(repository);
      const preference = await repository.getByUserId(USER);

      // When
      preference.changeSettings({
        pushEnabled: false,
        morningReminderMinute: 0,
        timezone: "Asia/Seoul",
      });
      await repository.save(preference);

      // Then
      expect(await repository.findReadModelByUserId(USER)).toEqual({
        ...COLUMN_DEFAULTS,
        userId: USER.value,
        pushEnabled: false,
        timezone: "Asia/Seoul",
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedDate: YESTERDAY,
      });
    });

    it("설정 변경은 읽은 뒤 다른 요청이 저장한 연속 완료를 덮지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await seedWithStreak(repository);
      const settingsRequest = await repository.getByUserId(USER);
      const completion = await repository.getByUserId(USER);
      completion.recordAllTodosCompleted(TODAY);
      await repository.save(completion);

      // When
      settingsRequest.changeSettings({ nightPushEnabled: false });
      const saved = await repository.save(settingsRequest);

      // Then
      expect(saved).toBe(true);
      expect(await repository.findReadModelByUserId(USER)).toMatchObject({
        nightPushEnabled: false,
        currentStreak: 2,
        longestStreak: 2,
        lastCompletedDate: TODAY,
      });
    });

    it("연속 완료는 읽은 값이 그대로일 때만 저장하고 늦은 저장은 false다", async () => {
      // Given
      const repository = await createRepository();
      await seed(repository, USER);
      const first = await repository.getByUserId(USER);
      const late = await repository.getByUserId(USER);
      first.recordAllTodosCompleted(TODAY);
      late.recordAllTodosCompleted(TODAY);

      // When
      const firstSaved = await repository.save(first);
      const lateSaved = await repository.save(late);

      // Then
      expect({ firstSaved, lateSaved }).toEqual({ firstSaved: true, lateSaved: false });
      expect(await repository.findReadModelByUserId(USER)).toMatchObject({
        currentStreak: 1,
        lastCompletedDate: TODAY,
      });
    });

    it("동의 변경은 자기 칸만 바꾸고 다른 동의를 둔다", async () => {
      // Given
      const repository = await createRepository();
      await seed(repository, USER, { termsAgreedAt: NOW, marketingAgreedAt: NOW });
      const preference = await repository.getByUserId(USER);
      const later = NOW.add({ hours: 1 });

      // When
      preference.changeMarketingPushConsent(true, later);
      await repository.save(preference);

      // Then
      expect((await repository.getByUserId(USER)).consent.toPrimitives()).toMatchObject({
        termsAgreedAt: NOW,
        marketingAgreedAt: NOW,
        marketingPushAgreedAt: later,
      });
    });

    it("동의 행이 없는 사용자의 동의 변경은 그 칸만 가진 행을 만들고 설정 행은 만들지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const preference = await repository.getByUserId(USER);

      // When
      preference.answerAiDataSharing({
        agreed: true,
        version: AI_DATA_SHARING_CONSENT.VERSION,
        now: NOW,
      });
      await repository.save(preference);

      // Then
      const reloaded = await repository.getByUserId(USER);
      expect(reloaded.consent.aiDataSharing().status().decision).toBe("AGREED");
      expect(reloaded.consent.toPrimitives()).toMatchObject({
        aiDataSharingAgreedAt: NOW,
        aiDataSharingVersion: AI_DATA_SHARING_CONSENT.VERSION,
        termsAgreedAt: null,
      });
      expect(await repository.findReadModelByUserId(USER)).toBeNull();
    });

    it("여러 사용자 읽기 모델은 설정 행이 있는 사용자만 주고 빈 목록이면 빈 배열이다", async () => {
      // Given
      const repository = await createRepository();
      await seed(repository, OTHER_USER);

      // When
      const found = await repository.listReadModelsByUserIds([USER, OTHER_USER]);
      const none = await repository.listReadModelsByUserIds([]);

      // Then
      expect(found).toEqual([{ ...COLUMN_DEFAULTS, userId: OTHER_USER.value }]);
      expect(none).toEqual([]);
    });

    it("refreshTimezoneIfChanged는 설정이 없으면 만들지 않고 0, 같으면 0, 다르면 1을 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const missing = await repository.refreshTimezoneIfChanged(USER, "Asia/Seoul");
      const created = await repository.findReadModelByUserId(USER);
      await seed(repository, USER);
      const unchanged = await repository.refreshTimezoneIfChanged(
        USER,
        DEFAULT_USER_PREFERENCE_SETTINGS.timezone,
      );
      const changed = await repository.refreshTimezoneIfChanged(USER, "Europe/London");

      // Then
      expect({ missing, created, unchanged, changed }).toEqual({
        missing: 0,
        created: null,
        unchanged: 0,
        changed: 1,
      });
      expect((await repository.findReadModelByUserId(USER))?.timezone).toBe("Europe/London");
    });
  });
}

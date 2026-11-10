import type { UserPreferenceRepositoryPort } from "#api/modules/identity/preferences/application/ports/user-preference.repository.port";
import type { StreakState } from "#api/modules/identity/preferences/domain/streak.vo";
import type { UserPreferenceRecord } from "#api/modules/identity/preferences/domain/user-preference.constants";
import {
  USER_SETTINGS_FIXTURE_OTHER_USER_ID,
  USER_SETTINGS_FIXTURE_USER_ID,
} from "#test/fixtures/identity/user-settings.fixture";

const USER_ID = USER_SETTINGS_FIXTURE_USER_ID;
const OTHER_USER_ID = USER_SETTINGS_FIXTURE_OTHER_USER_ID;

const COLUMN_DEFAULTS: UserPreferenceRecord = {
  pushEnabled: true,
  nightPushEnabled: true,
  timezone: "UTC",
  locale: "ko",
  morningReminderHour: 8,
  morningReminderMinute: 0,
  eveningReminderHour: 19,
  eveningReminderMinute: 0,
  timeFormat: "TWELVE_HOUR",
  weatherMorningEnabled: true,
  weatherMorningHour: 7,
  weatherMorningMinute: 0,
  weatherEveningEnabled: true,
  weatherEveningHour: 17,
  weatherEveningMinute: 30,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
};

const INITIAL_STREAK: StreakState = { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
const SAVED_STREAK: StreakState = {
  currentStreak: 2,
  longestStreak: 5,
  lastCompletedDate: Temporal.PlainDate.from("2026-11-09"),
};

export function describeUserPreferenceRepositoryContract(
  createRepository: () => Promise<UserPreferenceRepositoryPort>,
): void {
  describe("사용자 설정 저장소 계약", () => {
    it("설정이 없는 사용자는 찾지 못한다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const record = await repository.findByUserId(USER_ID);
      const streak = await repository.findStreakByUserId(USER_ID);

      // Then
      expect({ record, streak }).toEqual({ record: null, streak: null });
    });

    it("값 없이 만든 설정은 DB 열 기본값으로 채우고 같은 값을 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const created = await repository.create(USER_ID);
      const found = await repository.findByUserId(USER_ID);

      // Then
      expect(created).toMatchObject(COLUMN_DEFAULTS);
      expect(found).toMatchObject(COLUMN_DEFAULTS);
    });

    it("만들 때 준 값은 그대로 쓰고 빠진 값은 기본값을 쓴다", async () => {
      // Given
      const repository = await createRepository();
      const data = {
        pushEnabled: false,
        nightPushEnabled: false,
        timezone: "Asia/Seoul",
        timeFormat: "TWENTY_FOUR_HOUR",
        weatherMorningMinute: 15,
      } as const;

      // When
      await repository.create(USER_ID, data);

      // Then
      expect(await repository.findByUserId(USER_ID)).toMatchObject({
        ...COLUMN_DEFAULTS,
        ...data,
      });
    });

    it("이미 설정이 있는 사용자에게 다시 만들면 실패한다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID);

      // When
      const duplicated = repository.create(USER_ID, { timezone: "Asia/Seoul" });

      // Then
      await expect(duplicated).rejects.toThrow();
      expect((await repository.findByUserId(USER_ID))?.timezone).toBe("UTC");
    });

    it("upsert는 설정이 없으면 기본값 위에 준 값으로 만든다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const written = await repository.upsert(USER_ID, {
        nightPushEnabled: false,
        morningReminderHour: 9,
        weatherEveningEnabled: false,
      });

      // Then
      const expected = {
        ...COLUMN_DEFAULTS,
        nightPushEnabled: false,
        morningReminderHour: 9,
        weatherEveningEnabled: false,
      };
      expect(written).toMatchObject(expected);
      expect(await repository.findByUserId(USER_ID)).toMatchObject(expected);
    });

    it("upsert는 준 값(false·0 포함)만 바꾸고 undefined·빠진 값과 연속 완료는 둔다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { timezone: "Asia/Seoul", weatherMorningMinute: 17 });
      await repository.updateStreakIfUnchanged(USER_ID, INITIAL_STREAK, SAVED_STREAK);

      // When
      const written = await repository.upsert(USER_ID, {
        pushEnabled: false,
        weatherMorningHour: 0,
        weatherMorningMinute: undefined,
        timezone: undefined,
      });

      // Then
      const expected = {
        ...COLUMN_DEFAULTS,
        ...SAVED_STREAK,
        timezone: "Asia/Seoul",
        pushEnabled: false,
        weatherMorningHour: 0,
        weatherMorningMinute: 17,
      };
      expect(written).toMatchObject(expected);
      expect(await repository.findByUserId(USER_ID)).toMatchObject(expected);
    });

    it("upsert에 바꿀 값이 없으면 기존 설정을 그대로 돌려준다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { timezone: "Europe/Paris" });

      // When
      const written = await repository.upsert(USER_ID, {});

      // Then
      expect(written).toMatchObject({ ...COLUMN_DEFAULTS, timezone: "Europe/Paris" });
    });

    it("여러 사용자 조회는 설정이 있는 사용자만 userId와 함께 주고 빈 목록이면 빈 배열이다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { timezone: "Asia/Seoul" });
      await repository.create(OTHER_USER_ID, { timezone: "America/New_York" });

      // When
      const found = await repository.findByUserIds([OTHER_USER_ID, "missing-user", OTHER_USER_ID]);
      const both = await repository.findByUserIds([USER_ID, OTHER_USER_ID]);
      const none = await repository.findByUserIds([]);

      // Then
      expect(found).toMatchObject([
        { ...COLUMN_DEFAULTS, userId: OTHER_USER_ID, timezone: "America/New_York" },
      ]);
      expect(both.map((record) => [record.userId, record.timezone]).toSorted()).toEqual([
        [USER_ID, "Asia/Seoul"],
        [OTHER_USER_ID, "America/New_York"],
      ]);
      expect(none).toEqual([]);
    });

    it("upsertTimezone은 새로 만들거나 값을 바꾸면 true, 같은 값이면 false다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const created = await repository.upsertTimezone(USER_ID, "Asia/Seoul");
      const unchanged = await repository.upsertTimezone(USER_ID, "Asia/Seoul");
      const changed = await repository.upsertTimezone(USER_ID, "America/New_York");

      // Then
      expect({ created, unchanged, changed }).toEqual({
        created: true,
        unchanged: false,
        changed: true,
      });
      expect(await repository.findByUserId(USER_ID)).toMatchObject({
        ...COLUMN_DEFAULTS,
        timezone: "America/New_York",
      });
    });

    it("refreshTimezoneIfChanged는 설정이 없으면 만들지 않고 0, 같으면 0, 다르면 1을 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const missing = await repository.refreshTimezoneIfChanged(USER_ID, "Asia/Seoul");
      const created = await repository.findByUserId(USER_ID);
      await repository.create(USER_ID, { timezone: "Asia/Seoul" });
      const unchanged = await repository.refreshTimezoneIfChanged(USER_ID, "Asia/Seoul");
      const changed = await repository.refreshTimezoneIfChanged(USER_ID, "Europe/London");

      // Then
      expect({ missing, created, unchanged, changed }).toEqual({
        missing: 0,
        created: null,
        unchanged: 0,
        changed: 1,
      });
      expect((await repository.findByUserId(USER_ID))?.timezone).toBe("Europe/London");
    });

    it("upsertLocale은 설정이 없으면 기본값으로 만들고 있으면 언어만 바꾼다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(OTHER_USER_ID, { timezone: "Asia/Tokyo", pushEnabled: false });

      // When
      await repository.upsertLocale(USER_ID, "en");
      await repository.upsertLocale(OTHER_USER_ID, "en-US");

      // Then
      expect(await repository.findByUserId(USER_ID)).toMatchObject({
        ...COLUMN_DEFAULTS,
        locale: "en",
      });
      expect(await repository.findByUserId(OTHER_USER_ID)).toMatchObject({
        ...COLUMN_DEFAULTS,
        timezone: "Asia/Tokyo",
        pushEnabled: false,
        locale: "en-US",
      });
    });

    it("연속 완료는 기대한 상태와 같을 때만 바꾸고 Aggregate로 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID);
      const next = {
        currentStreak: 3,
        longestStreak: 5,
        lastCompletedDate: Temporal.PlainDate.from("2026-11-10"),
      };

      // When
      const first = await repository.updateStreakIfUnchanged(USER_ID, INITIAL_STREAK, SAVED_STREAK);
      const stale = await repository.updateStreakIfUnchanged(USER_ID, INITIAL_STREAK, next);
      const advanced = await repository.updateStreakIfUnchanged(USER_ID, SAVED_STREAK, next);
      const streak = await repository.findStreakByUserId(USER_ID);

      // Then
      expect({ first, stale, advanced }).toEqual({ first: true, stale: false, advanced: true });
      expect(streak?.streakState).toEqual(next);
      expect(await repository.findByUserId(USER_ID)).toMatchObject(next);
    });

    it("연속 완료 CAS는 마지막 완료일이 비어 있는지도 비교하고 설정이 없으면 false다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID);

      // When
      const mismatchedDate = await repository.updateStreakIfUnchanged(
        USER_ID,
        { ...INITIAL_STREAK, lastCompletedDate: SAVED_STREAK.lastCompletedDate },
        SAVED_STREAK,
      );
      const missing = await repository.updateStreakIfUnchanged(
        OTHER_USER_ID,
        INITIAL_STREAK,
        SAVED_STREAK,
      );

      // Then
      expect({ mismatchedDate, missing }).toEqual({ mismatchedDate: false, missing: false });
      expect((await repository.findStreakByUserId(USER_ID))?.streakState).toEqual(INITIAL_STREAK);
      expect(await repository.findByUserId(OTHER_USER_ID)).toBeNull();
    });
  });
}

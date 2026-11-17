import { omit } from "es-toolkit";

import { UserPreferenceRepositoryPort } from "#api/modules/identity/user-preferences/application/ports/user-preference.repository.port";
import type { UserPreferenceReadModel } from "#api/modules/identity/user-preferences/application/read-models/preference.read-model";
import type { StreakState } from "#api/modules/identity/user-preferences/domain/streak.vo";
import {
  DEFAULT_USER_PREFERENCE_SETTINGS,
  UserPreference,
} from "#api/modules/identity/user-preferences/domain/user-preference.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InMemoryUserConsentRepository } from "./in-memory-user-consent.repository.js";

// UserPreference 테이블의 열 기본값과 같다
const COLUMN_DEFAULTS: Omit<UserPreferenceReadModel, "userId"> = {
  ...DEFAULT_USER_PREFERENCE_SETTINGS,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
};

function sameStreak(record: UserPreferenceReadModel, streak: StreakState): boolean {
  return (
    record.currentStreak === streak.currentStreak &&
    record.longestStreak === streak.longestStreak &&
    record.lastCompletedDate?.toString() === streak.lastCompletedDate?.toString()
  );
}

/** 설정 행을 두고 동의 행은 같은 시나리오의 동의 저장소에 쓴다 */
export class InMemoryUserPreferenceRepository extends UserPreferenceRepositoryPort {
  readonly #records = new Map<string, UserPreferenceReadModel>();
  readonly #consents: InMemoryUserConsentRepository;

  constructor(
    records: readonly UserPreferenceReadModel[] = [],
    consents: InMemoryUserConsentRepository = new InMemoryUserConsentRepository(),
  ) {
    super();
    for (const record of records) {
      this.#records.set(record.userId, { ...record });
    }
    this.#consents = consents;
  }

  get all(): readonly UserPreferenceReadModel[] {
    return [...this.#records.values()].map((record) => ({ ...record }));
  }

  // 다른 요청이 먼저 연속 완료를 저장한 상황을 만든다
  commitStreak(userId: string, streak: StreakState): void {
    const existing = this.#records.get(userId);
    if (existing != null) {
      this.#records.set(userId, { ...existing, ...streak });
    }
  }

  stored(userId: string): UserPreferenceReadModel | undefined {
    const record = this.#records.get(userId);
    return record == null ? undefined : { ...record };
  }

  async findByUserId(userId: UserId): Promise<UserPreference> {
    const record = this.#records.get(userId.value);
    const consent = this.#consents.stored(userId.value);
    return UserPreference.reconstitute({
      userId: userId.value,
      settings: record == null ? null : settingsOf(record),
      streak:
        record == null
          ? null
          : {
              currentStreak: record.currentStreak,
              longestStreak: record.longestStreak,
              lastCompletedDate: record.lastCompletedDate,
            },
      consent: {
        userId: userId.value,
        termsAgreedAt: consent?.termsAgreedAt ?? null,
        privacyAgreedAt: consent?.privacyAgreedAt ?? null,
        agreedTermsVersion: consent?.agreedTermsVersion ?? null,
        marketingAgreedAt: consent?.marketingAgreedAt ?? null,
        marketingPushAgreedAt: consent?.marketingPushAgreedAt ?? null,
        aiDataSharingAgreedAt: consent?.aiDataSharingAgreedAt ?? null,
        aiDataSharingVersion: consent?.aiDataSharingVersion ?? null,
      },
    });
  }

  async findReadModelByUserId(userId: UserId): Promise<UserPreferenceReadModel | null> {
    return this.stored(userId.value) ?? null;
  }

  async findReadModelsByUserIds(userIds: readonly UserId[]): Promise<UserPreferenceReadModel[]> {
    return this.all.filter((record) => userIds.some((userId) => userId.value === record.userId));
  }

  async save(preference: UserPreference): Promise<boolean> {
    const userId = preference.id.value;
    if (preference.isNew()) {
      const { settings, streak, consent } = preference.toPrimitives();
      if (this.#records.has(userId)) {
        throw new Error(`UserPreference already exists for ${userId}`);
      }
      this.#records.set(userId, { ...COLUMN_DEFAULTS, ...settings, ...streak, userId });
      this.#consents.merge(userId, consent);
      return true;
    }
    const changes = preference.changesSinceLoad();
    const existing = this.#records.get(userId);
    if (
      changes.streak != null &&
      (existing == null || !sameStreak(existing, changes.streak.loaded))
    ) {
      return false;
    }
    const columns = { ...changes.settings, ...changes.streak?.next };
    if (Object.keys(columns).length > 0) {
      this.#records.set(userId, { ...(existing ?? { ...COLUMN_DEFAULTS, userId }), ...columns });
    }
    if (Object.keys(changes.consent).length > 0) {
      this.#consents.merge(userId, changes.consent);
    }
    return true;
  }

  async refreshTimezoneIfChanged(userId: UserId, timezone: string): Promise<number> {
    const existing = this.#records.get(userId.value);
    if (existing == null || existing.timezone === timezone) {
      return 0;
    }
    this.#records.set(userId.value, { ...existing, timezone });
    return 1;
  }
}

function settingsOf(record: UserPreferenceReadModel) {
  return omit(record, ["userId", "currentStreak", "longestStreak", "lastCompletedDate"]);
}

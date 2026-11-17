import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";
import { omit, pickBy } from "es-toolkit";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { Streak, type StreakState } from "./streak.vo.js";
import {
  type ConsentAgreement,
  UserConsent,
  type UserConsentPrimitives,
} from "./user-consent.entity.js";
import type { TimeFormatValue } from "./user-preference.constants.js";

// 저장소가 바뀐 칸을 칸 이름으로 고르도록 type으로 둔다
export type UserPreferenceSettings = {
  readonly pushEnabled: boolean;
  readonly nightPushEnabled: boolean;
  readonly timezone: string;
  readonly locale: string;
  readonly morningReminderHour: number;
  readonly morningReminderMinute: number;
  readonly eveningReminderHour: number;
  readonly eveningReminderMinute: number;
  readonly timeFormat: TimeFormatValue;
  readonly weatherMorningEnabled: boolean;
  readonly weatherMorningHour: number;
  readonly weatherMorningMinute: number;
  readonly weatherEveningEnabled: boolean;
  readonly weatherEveningHour: number;
  readonly weatherEveningMinute: number;
  readonly aiPushEnabled: boolean;
};

/** 앱이 바꾸는 설정. 언어는 푸시 기기 등록이 따로 바꾼다 */
export type PreferenceSettingChanges = Partial<Omit<UserPreferenceSettings, "locale">>;

export interface UserPreferencePrimitives {
  readonly userId: string;
  /** 설정 행이 없는 옛 사용자는 null이다. 설정을 처음 바꿀 때 기본값 위에 만든다 */
  readonly settings: UserPreferenceSettings | null;
  /** 설정 행이 없으면 null이고 연속 완료를 세지 않는다 */
  readonly streak: StreakState | null;
  readonly consent: UserConsentPrimitives;
}

/** 읽은 뒤 바뀐 칸. 저장소가 이 칸만 써서 다른 요청이 쓴 칸을 덮지 않는다 */
export interface UserPreferenceChanges {
  readonly settings: Partial<UserPreferenceSettings>;
  readonly streak: { readonly loaded: StreakState; readonly next: StreakState } | null;
  readonly consent: Partial<Omit<UserConsentPrimitives, "userId">>;
}

interface UserPreferenceProps {
  settings: UserPreferenceSettings;
  isSettingsStored: boolean;
  streak: Streak | null;
  readonly consent: UserConsent;
}

/** 설정 행이 없을 때와 가입 때의 설정. DB 기본값과 같다 */
export const DEFAULT_USER_PREFERENCE_SETTINGS: UserPreferenceSettings = {
  pushEnabled: USER_PREFERENCE_DEFAULTS.PUSH_ENABLED,
  nightPushEnabled: USER_PREFERENCE_DEFAULTS.NIGHT_PUSH_ENABLED,
  timezone: USER_PREFERENCE_DEFAULTS.TIMEZONE,
  // 언어는 푸시 기기 등록이 곧 실제 값으로 바꾼다
  locale: "ko",
  morningReminderHour: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR,
  morningReminderMinute: USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE,
  eveningReminderHour: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR,
  eveningReminderMinute: USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE,
  timeFormat: USER_PREFERENCE_DEFAULTS.TIME_FORMAT,
  weatherMorningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_ENABLED,
  weatherMorningHour: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_HOUR,
  weatherMorningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_MORNING_MINUTE,
  weatherEveningEnabled: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_ENABLED,
  weatherEveningHour: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_HOUR,
  weatherEveningMinute: USER_PREFERENCE_DEFAULTS.WEATHER_EVENING_MINUTE,
  aiPushEnabled: USER_PREFERENCE_DEFAULTS.AI_PUSH_ENABLED,
};

const STREAK_MILESTONE_DAYS = 3;

/** 사용자 설정·연속 완료·동의. 설정·동의는 바꾼 칸만, 연속 완료는 읽은 값이 그대로일 때만 저장한다 */
export class UserPreference extends AggregateRoot<UserId, UserPreferenceProps> {
  // 가입 트랜잭션이 기본 설정과 받은 동의로 두 행을 만든다
  static create(params: {
    readonly userId: UserId;
    readonly consent: ConsentAgreement;
  }): UserPreference {
    return new UserPreference(params.userId, {
      settings: DEFAULT_USER_PREFERENCE_SETTINGS,
      isSettingsStored: true,
      streak: Streak.reconstitute({ currentStreak: 0, longestStreak: 0, lastCompletedDate: null }),
      consent: UserConsent.create(params.userId, params.consent),
    });
  }

  static reconstitute(primitives: UserPreferencePrimitives): UserPreference {
    const preference = new UserPreference(UserId.reconstitute(primitives.userId), {
      settings: primitives.settings ?? DEFAULT_USER_PREFERENCE_SETTINGS,
      isSettingsStored: primitives.settings != null,
      streak: primitives.streak == null ? null : Streak.reconstitute(primitives.streak),
      consent: UserConsent.reconstitute(primitives.consent),
    });
    preference.#loaded = primitives;
    return preference;
  }

  #loaded: UserPreferencePrimitives | null = null;

  get settings(): UserPreferenceSettings {
    return this.props.settings;
  }

  get streakState(): StreakState | null {
    return this.props.streak?.value ?? null;
  }

  get consent(): UserConsent {
    return this.props.consent;
  }

  isNew(): boolean {
    return this.#loaded == null;
  }

  isStreakTracked(): boolean {
    return this.props.streak != null;
  }

  hasTodoCompletionOn(date: Temporal.PlainDate): boolean {
    return this.props.streak?.isCompletedOn(date) ?? false;
  }

  // 오늘 완료로 연속 완료가 막 3일이 됐다. 완료 반영(recordAllTodosCompleted) 뒤에만 묻는다
  hasReachedStreakMilestone(): boolean {
    return this.props.streak?.currentStreak === STREAK_MILESTONE_DAYS;
  }

  // 준 칸만 바꾼다(PATCH). 모두 지금 값과 같으면 false다. 설정 행이 없으면 기본값 위에 만든다
  changeSettings(changes: PreferenceSettingChanges): boolean {
    const settings = this.props.settings;
    const updates = pickBy(changes, (value, key) => value != null && settings[key] !== value);
    return this.#applySettings({ ...settings, ...updates }, Object.keys(updates).length > 0);
  }

  changeTimezone(timezone: string): boolean {
    return this.changeSettings({ timezone });
  }

  changeLocale(locale: string): boolean {
    const settings = this.props.settings;
    return this.#applySettings({ ...settings, locale }, settings.locale !== locale);
  }

  changeMarketingConsent(agreed: boolean, now: Temporal.Instant): boolean {
    return this.props.consent.changeMarketing(agreed, now);
  }

  changeMarketingPushConsent(agreed: boolean, now: Temporal.Instant): boolean {
    return this.props.consent.changeMarketingPush(agreed, now);
  }

  answerAiDataSharing(params: {
    readonly agreed: boolean;
    readonly version: string;
    readonly now: Temporal.Instant;
  }): boolean {
    return this.props.consent.answerAiDataSharing(params);
  }

  // 그날 할 일을 모두 끝냈다. 이미 센 날이거나 연속 완료를 세지 않는 옛 사용자면 false다
  recordAllTodosCompleted(today: Temporal.PlainDate): boolean {
    const plan = this.props.streak?.planCompletion(today);
    if (plan == null) {
      return false;
    }
    this.props.streak = Streak.reconstitute(plan.nextState);
    return true;
  }

  // 그날 완료를 되돌렸다. 그날 반영한 완료가 없으면 false다
  recordTodoReopened(today: Temporal.PlainDate, hadPreviousDayCompletion: boolean): boolean {
    const next = this.props.streak?.planUncompletion(today, hadPreviousDayCompletion);
    if (next == null) {
      return false;
    }
    this.props.streak = Streak.reconstitute(next);
    return true;
  }

  changesSinceLoad(): UserPreferenceChanges {
    const loaded = this.#loaded;
    const current = this.toPrimitives();
    if (loaded == null) {
      return {
        settings: this.props.settings,
        streak: null,
        consent: withoutUserId(current.consent),
      };
    }
    return {
      settings: this.#settingChangesSince(loaded.settings),
      streak:
        loaded.streak == null || current.streak == null || sameStreak(loaded.streak, current.streak)
          ? null
          : { loaded: loaded.streak, next: current.streak },
      consent: changedFields(withoutUserId(loaded.consent), withoutUserId(current.consent)),
    };
  }

  toPrimitives(): UserPreferencePrimitives {
    return {
      userId: this.id.value,
      settings: this.props.isSettingsStored ? this.props.settings : null,
      streak: this.streakState,
      consent: this.props.consent.toPrimitives(),
    };
  }

  #applySettings(next: UserPreferenceSettings, changed: boolean): boolean {
    if (!changed && this.props.isSettingsStored) {
      return false;
    }
    this.props.settings = next;
    this.props.isSettingsStored = true;
    return true;
  }

  #settingChangesSince(loaded: UserPreferenceSettings | null): Partial<UserPreferenceSettings> {
    if (loaded != null) {
      return changedFields(loaded, this.props.settings);
    }
    return this.props.isSettingsStored ? this.props.settings : {};
  }
}

function withoutUserId(consent: UserConsentPrimitives): Omit<UserConsentPrimitives, "userId"> {
  return omit(consent, ["userId"]);
}

function sameStreak(left: StreakState, right: StreakState): boolean {
  const sameDate =
    left.lastCompletedDate == null || right.lastCompletedDate == null
      ? left.lastCompletedDate == null && right.lastCompletedDate == null
      : left.lastCompletedDate.equals(right.lastCompletedDate);
  return (
    left.currentStreak === right.currentStreak &&
    left.longestStreak === right.longestStreak &&
    sameDate
  );
}

// Temporal 값은 같은 시각의 다른 객체라 equals로 비교한다
function changedFields<T extends Record<string, unknown>>(loaded: T, current: T): Partial<T> {
  return pickBy(current, (value, key) => !sameValue(loaded[key], value));
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Temporal.Instant && right instanceof Temporal.Instant) {
    return left.equals(right);
  }
  return left === right;
}

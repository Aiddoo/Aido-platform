import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { StreakState } from "../../domain/streak.vo.js";
import type { UserPreference } from "../../domain/user-preference.aggregate.js";
import type {
  TimeFormatValue,
  UserPreferenceRecord,
} from "../../domain/user-preference.constants.js";

/** 배치 조회용 설정 레코드 (사용자 식별자 포함). */
export type UserPreferenceRecordWithId = UserPreferenceRecord & {
  userId: string;
};

/** 설정 upsert 입력 (부분 갱신) */
export interface PreferenceWriteInput {
  pushEnabled?: boolean;
  nightPushEnabled?: boolean;
  timezone?: string;
  morningReminderHour?: number;
  morningReminderMinute?: number;
  eveningReminderHour?: number;
  eveningReminderMinute?: number;
  timeFormat?: TimeFormatValue;
  weatherMorningEnabled?: boolean;
  weatherMorningHour?: number;
  weatherMorningMinute?: number;
  weatherEveningEnabled?: boolean;
  weatherEveningHour?: number;
  weatherEveningMinute?: number;
}

/**
 * 설정 리포지토리 포트.
 */
export abstract class UserPreferenceRepositoryPort {
  abstract findByUserId(userId: UserId): Promise<UserPreferenceRecord | null>;
  /** 연속 완료 전이를 가진 설정 Aggregate. 설정 행이 없으면 null */
  abstract findStreakByUserId(userId: UserId): Promise<UserPreference | null>;
  abstract findByUserIds(userIds: readonly UserId[]): Promise<UserPreferenceRecordWithId[]>;
  abstract create(userId: UserId, data?: PreferenceWriteInput): Promise<UserPreferenceRecord>;
  abstract upsert(userId: UserId, data: PreferenceWriteInput): Promise<UserPreferenceRecord>;
  /** 시간대를 넣거나 바꾼다. 실제로 달라졌으면(행을 새로 만든 경우 포함) true다. */
  abstract upsertTimezone(userId: UserId, timezone: string): Promise<boolean>;
  /**
   * 저장된 타임존이 다를 때만 갱신하고, 실제 갱신된 행 수를 반환한다.
   *
   * 자가치유(핫패스)용 — 값이 같으면 0행(no-op)이라 쓰기 증폭·캐시 무효화가 없다.
   * 행이 없으면(설정 미생성) 0을 반환한다(신규 생성하지 않음 — 토큰 등록 upsert가 담당).
   */
  abstract refreshTimezoneIfChanged(userId: UserId, timezone: string): Promise<number>;
  abstract upsertLocale(userId: UserId, locale: string): Promise<void>;
  abstract updateStreakIfUnchanged(
    userId: UserId,
    expected: StreakState,
    next: StreakState,
  ): Promise<boolean>;
}

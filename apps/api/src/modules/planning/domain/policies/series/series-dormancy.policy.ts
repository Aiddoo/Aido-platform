import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import {
  localDateInTimezone,
  resolveDeliveryTimezone,
} from "#api/shared/domain/date/utils/timezone";

/** 마지막으로 움직인 날에서 이 일수를 넘기면 휴면이다. 그 날 자체는 아직 휴면이 아니다. */
export const TODO_SERIES_DORMANT_AFTER_DAYS = 60;

export interface SeriesOwnerActivity {
  readonly lastActiveAt: Date | null;
  readonly signedUpAt: Date;
  /** UserPreference.timezone. 설정 행이 없으면 null이다. */
  readonly timezone: string | null;
}

export function isDormantSince(lastMovedAt: Date, timezone: string, at: Date): boolean {
  const lastDay = localDateInTimezone(lastMovedAt, timezone);
  return (
    addDaysToDateKey(lastDay, TODO_SERIES_DORMANT_AFTER_DAYS) < localDateInTimezone(at, timezone)
  );
}

/** 활동 기록이 없는 계정은 가입일로 잰다. 시간대가 미상이면 알림 자격 판정과 같은 기본값을 쓴다. */
export function isSeriesOwnerDormant(owner: SeriesOwnerActivity, at: Date): boolean {
  return isDormantSince(
    owner.lastActiveAt ?? owner.signedUpAt,
    resolveDeliveryTimezone(owner.timezone),
    at,
  );
}

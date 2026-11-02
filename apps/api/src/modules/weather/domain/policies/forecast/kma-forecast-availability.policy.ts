import { clamp } from "es-toolkit";

import { addDays, addMinutes } from "#api/shared/domain/date/utils/arithmetic";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

/** KMA 발표·예보 날짜는 서버 시간대와 무관하게 KST다. */
export const KMA_TIMEZONE = "Asia/Seoul";

/**
 * KMA 단기예보가 응답하는 범위.
 *
 * - 발표는 오늘을 포함한 최근 3일 것만 준다(그 전은 resultCode 10 "최근 3일 간의 자료만 제공").
 * - 아직 하지 않은 발표는 줄 수 없다(resultCode 10 "현재 이후의 base_time은 호출할 수 없습니다").
 * - 한 발표는 발표일부터 이틀 뒤(모레)까지의 예보를 담는다.
 */
export const KMA_FORECAST_AVAILABILITY = {
  ISSUANCE_RETENTION_DAYS: 3,
  FORECAST_DAYS_AFTER_ISSUANCE: 2,
  /** 하루 첫 발표(02:00)와 제공 지연 15분 */
  FIRST_ISSUANCE_OFFSET_MINUTES: 2 * 60 + 15,
} as const;

/** 예보 대상 날짜와 그 예보를 받아 올 발표 시각. 둘은 다를 수 있다. */
export interface KmaForecastTiming {
  readonly target: Date;
  readonly issuance: Date;
}

export type KmaForecastAvailability =
  | { readonly kind: "AVAILABLE"; readonly timing: KmaForecastTiming }
  | { readonly kind: "UNAVAILABLE" };

export const KmaForecastAvailabilityPolicy = {
  /**
   * 요청 날짜의 예보를 줄 수 있는 발표를 고른다. 미래 날짜는 지금의 최신 발표로, 3일보다 오래된
   * 시각은 보관 중인 가장 이른 발표로 당긴다. 어느 발표의 예보 범위에도 없는 날짜는 UNAVAILABLE이다.
   */
  resolve(target: Date, now: Date): KmaForecastAvailability {
    const today = dayWindowInTimezone(now, KMA_TIMEZONE);
    const targetDay = dayWindowInTimezone(target, KMA_TIMEZONE).localDate;
    const earliestDay = dayWindowInTimezone(
      addDays(1 - KMA_FORECAST_AVAILABILITY.ISSUANCE_RETENTION_DAYS, today.startsAt),
      KMA_TIMEZONE,
    );
    const latestDay = dayWindowInTimezone(
      addDays(KMA_FORECAST_AVAILABILITY.FORECAST_DAYS_AFTER_ISSUANCE, today.startsAt),
      KMA_TIMEZONE,
    ).localDate;
    if (targetDay < earliestDay.localDate || targetDay > latestDay) {
      return { kind: "UNAVAILABLE" };
    }

    const earliestIssuance = addMinutes(
      KMA_FORECAST_AVAILABILITY.FIRST_ISSUANCE_OFFSET_MINUTES,
      earliestDay.startsAt,
    );
    const issuance = new Date(clamp(target.getTime(), earliestIssuance.getTime(), now.getTime()));
    return { kind: "AVAILABLE", timing: { target, issuance } };
  },
};

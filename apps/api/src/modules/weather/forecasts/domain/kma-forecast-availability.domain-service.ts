import { clamp } from "es-toolkit";

import {
  localDateAt,
  startOfLocalDate,
} from "../../shared/domain/weather-calendar.domain-service.js";

/** KMA 발표·예보 날짜는 서버 시간대와 무관하게 KST다. */
export const KMA_TIMEZONE = "Asia/Seoul";

/**
 * KMA 단기예보가 응답하는 범위.
 *
 * - 발표는 오늘을 포함한 최근 3일 것만 준다(그 전은 resultCode 10 "최근 3일 간의 자료만 제공").
 * - 아직 하지 않은 발표는 줄 수 없다(resultCode 10 "현재 이후의 base_time은 호출할 수 없습니다").
 * - 한 발표는 발표일부터 이틀 뒤(모레)까지의 예보를 담는다.
 */
const KMA_FORECAST_AVAILABILITY = {
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

/**
 * 요청 날짜의 예보를 줄 수 있는 발표를 고른다. 미래 날짜는 지금의 최신 발표로, 3일보다 오래된
 * 시각은 보관 중인 가장 이른 발표로 당긴다. 어느 발표의 예보 범위에도 없는 날짜는 UNAVAILABLE이다.
 */
export function resolveKmaForecastAvailability(params: {
  readonly target: Date;
  readonly now: Date;
}): KmaForecastAvailability {
  const { target, now } = params;
  const today = localDateAt(now, KMA_TIMEZONE);
  const targetDay = localDateAt(target, KMA_TIMEZONE);
  const earliestDay = today.subtract({
    days: KMA_FORECAST_AVAILABILITY.ISSUANCE_RETENTION_DAYS - 1,
  });
  const latestDay = today.add({ days: KMA_FORECAST_AVAILABILITY.FORECAST_DAYS_AFTER_ISSUANCE });
  if (
    Temporal.PlainDate.compare(targetDay, earliestDay) < 0 ||
    Temporal.PlainDate.compare(targetDay, latestDay) > 0
  ) {
    return { kind: "UNAVAILABLE" };
  }

  const earliestIssuanceMs =
    startOfLocalDate(earliestDay, KMA_TIMEZONE).getTime() +
    KMA_FORECAST_AVAILABILITY.FIRST_ISSUANCE_OFFSET_MINUTES * 60_000;
  const issuance = new Date(clamp(target.getTime(), earliestIssuanceMs, now.getTime()));
  return { kind: "AVAILABLE", timing: { target, issuance } };
}

import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type { ForecastAvailability } from "../../application/ports/weather-forecast-provider.port.js";
import { KMA_TIMEZONE } from "./kma.constants.js";

const KMA_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"] as const;
const KMA_PUBLICATION_INTERVAL_MINUTES = 180;
/** 발표 시각 뒤 자료가 실제로 나올 때까지의 여유 */
const KMA_PUBLICATION_DELAY_MINUTES = 15;

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
  FIRST_ISSUANCE_OFFSET_MINUTES: 2 * 60 + KMA_PUBLICATION_DELAY_MINUTES,
} as const;

type KmaBaseTime = (typeof KMA_BASE_TIMES)[number];

export interface KmaBaseDateTime {
  readonly baseDate: string;
  readonly baseTime: KmaBaseTime;
}

/** KMA 발표일은 서버 TZ와 무관하게 KST이며 발표마다 15분 제공 여유를 둔다. */
export function toKmaBaseDateTime(issuance: Temporal.Instant): KmaBaseDateTime {
  const local = issuance.toZonedDateTimeISO(KMA_TIMEZONE);
  const time = local.hour * 100 + local.minute;
  const baseTime = KMA_BASE_TIMES.findLast(
    (candidate) => time >= Number(candidate) + KMA_PUBLICATION_DELAY_MINUTES,
  );
  const localDate = local.toPlainDate();
  const baseDate = baseTime == null ? localDate.subtract({ days: 1 }) : localDate;
  return {
    baseDate: baseDate.toString().replaceAll("-", ""),
    baseTime: baseTime ?? "2300",
  };
}

/** 발표 시각이 3시간 간격이므로 한 간격 전 시각의 발표가 직전 발표다. */
export function toPreviousKmaBaseDateTime(issuance: Temporal.Instant): KmaBaseDateTime {
  return toKmaBaseDateTime(issuance.subtract({ minutes: KMA_PUBLICATION_INTERVAL_MINUTES }));
}

function clampInstant(
  value: Temporal.Instant,
  earliest: Temporal.Instant,
  latest: Temporal.Instant,
): Temporal.Instant {
  if (Temporal.Instant.compare(value, earliest) < 0) {
    return earliest;
  }
  if (Temporal.Instant.compare(value, latest) > 0) {
    return latest;
  }
  return value;
}

/**
 * 요청 날짜의 예보를 줄 수 있는 발표를 고른다. 미래 날짜는 지금의 최신 발표로, 3일보다 오래된
 * 시각은 보관 중인 가장 이른 발표로 당긴다. 어느 발표의 예보 범위에도 없는 날짜는 UNAVAILABLE이다.
 */
export function resolveKmaForecastAvailability(params: {
  readonly target: Temporal.Instant;
  readonly now: Temporal.Instant;
}): ForecastAvailability {
  const { target, now } = params;
  const today = localDateIn(now, KMA_TIMEZONE);
  const targetDay = localDateIn(target, KMA_TIMEZONE);
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

  const earliestIssuance = earliestDay
    .toZonedDateTime(KMA_TIMEZONE)
    .toInstant()
    .add({ minutes: KMA_FORECAST_AVAILABILITY.FIRST_ISSUANCE_OFFSET_MINUTES });
  const issuance = clampInstant(target, earliestIssuance, now);
  return { kind: "AVAILABLE", timing: { target, issuance } };
}

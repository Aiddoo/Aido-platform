import { localDateTimeAt } from "../../shared/domain/weather-calendar.domain-service.js";
import { KMA_TIMEZONE } from "./kma-forecast-availability.domain-service.js";

const KMA_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"] as const;
const KMA_PUBLICATION_INTERVAL_MS = 180 * 60_000;

type KmaBaseTime = (typeof KMA_BASE_TIMES)[number];

export interface KmaBaseDateTime {
  readonly baseDate: string;
  readonly baseTime: KmaBaseTime;
}

/** KMA 발표일은 서버 TZ와 무관하게 KST이며 기존 15분 제공 여유를 유지한다. */
export function getKmaBaseDateTime(date: Date): KmaBaseDateTime {
  const local = localDateTimeAt(date, KMA_TIMEZONE);
  const time = local.hour * 100 + local.minute;
  const baseTime = KMA_BASE_TIMES.findLast((candidate) => time >= Number(candidate) + 15);
  const localDate = local.toPlainDate();
  const baseDate = baseTime == null ? localDate.subtract({ days: 1 }) : localDate;
  return {
    baseDate: baseDate.toString().replaceAll("-", ""),
    baseTime: baseTime ?? "2300",
  };
}

/** 발표 시각이 3시간 간격이므로 한 간격 전 시각의 발표가 직전 발표다. */
export function getPreviousKmaBaseDateTime(date: Date): KmaBaseDateTime {
  return getKmaBaseDateTime(new Date(date.getTime() - KMA_PUBLICATION_INTERVAL_MS));
}

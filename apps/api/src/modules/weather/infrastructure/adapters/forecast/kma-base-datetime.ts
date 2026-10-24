import { subtractDays, subtractMinutes } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { dayWindowInTimezone, toLocalTimeString } from "#api/shared/domain/date/utils/timezone";

import { KMA_TIMEZONE } from "./kma.constants.js";

const KMA_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"] as const;
const KMA_PUBLICATION_INTERVAL_MINUTES = 180;

export type KmaBaseTime = (typeof KMA_BASE_TIMES)[number];

export interface KmaBaseDateTime {
  readonly baseDate: string;
  readonly baseTime: KmaBaseTime;
}

/** KMA 발표일은 서버 TZ와 무관하게 KST이며 기존 15분 제공 여유를 유지한다. */
export function getKmaBaseDateTime(date: Date): KmaBaseDateTime {
  const time = Number(toLocalTimeString(date, KMA_TIMEZONE).replace(":", ""));
  const localDate = dayWindowInTimezone(date, KMA_TIMEZONE).date;
  const baseTime = KMA_BASE_TIMES.findLast((candidate) => time >= Number(candidate) + 15);
  const baseDate = baseTime === undefined ? subtractDays(1, localDate) : localDate;
  return {
    baseDate: toDateString(baseDate).replaceAll("-", ""),
    baseTime: baseTime ?? "2300",
  };
}

/** 발표 시각이 3시간 간격이므로 한 간격 전 시각의 발표가 직전 발표다. */
export function getPreviousKmaBaseDateTime(date: Date): KmaBaseDateTime {
  return getKmaBaseDateTime(subtractMinutes(KMA_PUBLICATION_INTERVAL_MINUTES, date));
}

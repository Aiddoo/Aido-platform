import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { dayWindowInTimezone, toLocalTimeString } from "#api/shared/domain/date/utils/timezone";

import { KMA_TIMEZONE } from "./kma.constants.js";

const KMA_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"] as const;

export interface KmaBaseDateTime {
  readonly baseDate: string;
  readonly baseTime: string;
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

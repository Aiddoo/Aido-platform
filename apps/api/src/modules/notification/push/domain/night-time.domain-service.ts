import { NIGHT_TIME_CONFIG } from "@aido/api/vocabulary";
import dayjs from "dayjs";

import { now } from "#api/shared/domain/date/utils/core";
import { resolveTimezone } from "#api/shared/domain/date/utils/timezone";

export function isNightTime(tz: string = "UTC", date: Date = now()): boolean {
  const localHour = dayjs(date).tz(resolveTimezone(tz)).hour();
  return localHour >= NIGHT_TIME_CONFIG.START_HOUR || localHour < NIGHT_TIME_CONFIG.END_HOUR;
}

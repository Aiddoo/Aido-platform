import type { TimezoneContext } from "#api/modules/notification/reminders/domain/timezone-context.read-model";
import { addDaysToDateKey } from "#api/shared/domain/date/utils/arithmetic";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";

/** 서울의 한 날짜(로컬 자정)에서 도는 sweep 분. 요일은 날짜에서 정한다 */
export function createTimezoneContextFixture(
  overrides: Partial<TimezoneContext> & { readonly date?: string } = {},
): TimezoneContext {
  const { date = "2024-01-16", ...context } = overrides;
  const today = parseDateOnly(date);
  return {
    tz: "Asia/Seoul",
    localHour: 8,
    localMinute: 0,
    dayOfWeek: today.getUTCDay(),
    today,
    tomorrow: parseDateOnly(addDaysToDateKey(date, 1)),
    ...context,
  };
}

import type { TimezoneContext } from "#api/modules/notification/reminders/domain/timezone-context.read-model";

/** 서울의 한 날짜(로컬 자정)에서 도는 sweep 분. 요일은 날짜에서 정한다 */
export function createTimezoneContextFixture(
  overrides: Partial<TimezoneContext> & { readonly date?: string } = {},
): TimezoneContext {
  const { date = "2024-01-16", ...context } = overrides;
  const today = Temporal.PlainDate.from(date);
  return {
    tz: "Asia/Seoul",
    localHour: 8,
    localMinute: 0,
    // Temporal은 월=1…일=7, 문맥은 일=0
    dayOfWeek: today.dayOfWeek % 7,
    today,
    tomorrow: today.add({ days: 1 }),
    ...context,
  };
}

import type { TimezoneContext } from "#api/modules/notification/reminders/domain/local-clock.domain-service";

/** 서울의 한 날짜(로컬 자정)에서 도는 sweep 분. 요일은 날짜에서 정한다 */
export function createTimezoneContextFixture(
  overrides: Partial<TimezoneContext> & { readonly date?: string } = {},
): TimezoneContext {
  const { date = "2024-01-16", ...context } = overrides;
  const today = Temporal.PlainDate.from(date);
  const localHour = context.localHour ?? 8;
  const localMinute = context.localMinute ?? 0;
  return {
    timezones: ["Asia/Seoul"],
    localHour,
    localMinute,
    // DST 전환이 없는 분이면 그 분의 시:분만 울린다(grace는 sweep 테스트가 본다)
    reminderTimes: [{ hour: localHour, minute: localMinute }],
    // Temporal은 월=1…일=7, 문맥은 일=0
    dayOfWeek: today.dayOfWeek % 7,
    today,
    tomorrow: today.add({ days: 1 }),
    ...context,
  };
}

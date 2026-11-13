import { groupBy } from "es-toolkit";

import type { TimezoneContext } from "./timezone-context.read-model.js";

// 처리하는 분의 현지 시각으로 시:분·요일·오늘을 정한다. 늦게 따라잡아도 그 분의 날짜로 보낸다
export function timezoneContextAt(
  timezones: readonly string[],
  local: Temporal.PlainDateTime,
  userId?: string,
): TimezoneContext {
  const today = local.toPlainDate();
  return {
    timezones,
    localHour: local.hour,
    localMinute: local.minute,
    // Temporal은 월=1…일=7, 컨텍스트는 일=0
    dayOfWeek: local.dayOfWeek % 7,
    today,
    tomorrow: today.add({ days: 1 }),
    userId,
  };
}

/**
 * 그 분에 현지 날짜·시·분·요일이 같은 시간대끼리 묶는다.
 * 같은 오프셋의 시간대는 전략이 한 번에 조회해 시간대 수만큼 같은 쿼리를 보내지 않는다.
 */
export function groupTimezonesByLocalClock(
  minute: Temporal.Instant,
  timezones: readonly string[],
): TimezoneContext[] {
  const locals = timezones.map((timezone) => ({
    timezone,
    local: minute.toZonedDateTimeISO(timezone).toPlainDateTime(),
  }));
  const groups = groupBy(
    locals,
    ({ local }) =>
      `${local.toPlainDate().toString()}|${local.hour}|${local.minute}|${local.dayOfWeek}`,
  );
  return Object.values(groups).flatMap((group) => {
    const [first] = group;
    if (first == null) {
      return [];
    }
    return [
      timezoneContextAt(
        group.map(({ timezone }) => timezone),
        first.local,
      ),
    ];
  });
}

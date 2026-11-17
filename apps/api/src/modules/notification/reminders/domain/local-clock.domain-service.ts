import { groupBy } from "es-toolkit";

// 사용자가 고른 리마인더 시:분
export interface ReminderTime {
  readonly hour: number;
  readonly minute: number;
}

// 가장 긴 DST 이동(2시간)보다 길게 거슬러 봐야 틈 뒤 첫 분에 틈 안의 시각을 모두 찾는다
const TRANSITION_LOOKBACK_MINUTES = 3 * 60;

/**
 * 타임존 리마인더 실행 컨텍스트 (도메인 값 타입).
 *
 * 오케스트레이터가 매분 스윕에서 현지 시각이 같은 타임존을 묶어 채우고,
 * 각 Strategy는 이 컨텍스트만 받아 발송 여부를 판단한다(프레임워크·DB 비의존).
 */
export interface TimezoneContext {
  /** 이 분에 현지 날짜·시·분이 같은 IANA 타임존들 (예: ["Asia/Seoul", "Asia/Tokyo"]) */
  readonly timezones: readonly string[];
  /** 로컬 시(0-23) */
  readonly localHour: number;
  /** 로컬 분(0-59) */
  readonly localMinute: number;
  /** 이 분에 울릴 사용자 지정 리마인더 시:분(reminderTimesDueAt) */
  readonly reminderTimes: readonly ReminderTime[];
  /** 로컬 요일 (0=일, 1=월, ...) */
  readonly dayOfWeek: number;
  /** 로컬 오늘 */
  readonly today: Temporal.PlainDate;
  /** 로컬 내일 */
  readonly tomorrow: Temporal.PlainDate;
  /** catch-up 발송 시 특정 유저만 대상 (없으면 전체 스윕) */
  readonly userId?: string;
}

/**
 * 그 날 그 시:분이 처음 오는 순간. 봄 DST 틈에 없는 시각은 틈 바로 뒤 첫 순간이고, 가을에 두 번 오는 시각은 앞의 것이다.
 * 오프셋을 직접 계산하지 않고 Temporal의 disambiguation과 시간대 전환으로 정한다.
 */
export function firstOccurrenceOf(
  date: Temporal.PlainDate,
  time: Temporal.PlainTime,
  timezone: string,
): Temporal.Instant {
  const wall = date.toPlainDateTime(time);
  const earlier = wall.toZonedDateTime(timezone, { disambiguation: "earlier" });
  if (earlier.toPlainDateTime().equals(wall)) {
    return earlier.toInstant();
  }
  // 없는 시각이면 earlier는 틈 앞으로 밀린 순간이고, 그다음 전환이 틈이 끝나는 순간이다
  return (earlier.getTimeZoneTransition("next") ?? earlier).toInstant();
}

/**
 * 이 분에 울릴 현지 시:분들. 평소에는 이 분의 시:분 하나다(놓친 분은 sweep의 15분 따라잡기가 다시 처리한다).
 * 봄 DST 틈에 없는 시각은 틈 바로 뒤 첫 분에 함께 울리고, 가을에 두 번 오는 시각은 앞의 것에만 울린다.
 */
export function reminderTimesDueAt(minute: Temporal.Instant, timezone: string): ReminderTime[] {
  const zoned = minute.toZonedDateTimeISO(timezone);
  const minutesSinceMidnight = zoned.hour * 60 + zoned.minute;
  // 이 분이 바로 전환 순간이어도 잡도록 1분 뒤에서 이전 전환을 찾는다
  const previousTransition = zoned.add({ minutes: 1 }).getTimeZoneTransition("previous");
  const isNearTransition =
    previousTransition != null &&
    Temporal.Instant.compare(
      previousTransition.toInstant(),
      minute.subtract({ minutes: TRANSITION_LOOKBACK_MINUTES }),
    ) > 0;
  const lookbackMinutes = Math.min(
    isNearTransition ? TRANSITION_LOOKBACK_MINUTES : 0,
    minutesSinceMidnight,
  );
  const previousMinute = minute.subtract({ minutes: 1 });
  const today = zoned.toPlainDate();
  return Array.from({ length: lookbackMinutes + 1 }, (_, back) =>
    zoned.toPlainTime().subtract({ minutes: back }),
  )
    .filter((time) => {
      const first = firstOccurrenceOf(today, time, timezone);
      return (
        Temporal.Instant.compare(previousMinute, first) < 0 &&
        Temporal.Instant.compare(first, minute) <= 0
      );
    })
    .map(({ hour, minute: timeMinute }) => ({ hour, minute: timeMinute }))
    .toSorted((left, right) => left.hour * 60 + left.minute - (right.hour * 60 + right.minute));
}

export function isReminderTimeDue(
  timezoneContext: Pick<TimezoneContext, "reminderTimes">,
  time: ReminderTime,
): boolean {
  return timezoneContext.reminderTimes.some(
    ({ hour, minute }) => hour === time.hour && minute === time.minute,
  );
}

// 처리하는 분의 현지 시각으로 시:분·요일·오늘과 울릴 리마인더 시각을 정한다. 늦게 따라잡아도 그 분의 날짜로 보낸다
export function timezoneContextAt(
  minute: Temporal.Instant,
  timezone: string,
  userId?: string,
): TimezoneContext {
  return contextOf({
    timezones: [timezone],
    local: minute.toZonedDateTimeISO(timezone).toPlainDateTime(),
    reminderTimes: reminderTimesDueAt(minute, timezone),
    userId,
  });
}

function contextOf({
  timezones,
  local,
  reminderTimes,
  userId,
}: {
  readonly timezones: readonly string[];
  readonly local: Temporal.PlainDateTime;
  readonly reminderTimes: readonly ReminderTime[];
  readonly userId?: string;
}): TimezoneContext {
  const today = local.toPlainDate();
  return {
    timezones,
    localHour: local.hour,
    localMinute: local.minute,
    reminderTimes,
    // Temporal은 월=1…일=7, 컨텍스트는 일=0
    dayOfWeek: local.dayOfWeek % 7,
    today,
    tomorrow: today.add({ days: 1 }),
    userId,
  };
}

/**
 * 그 분에 현지 날짜·시·분·요일과 울릴 리마인더 시각이 같은 시간대끼리 묶는다.
 * 같은 오프셋의 시간대는 전략이 한 번에 조회해 시간대 수만큼 같은 쿼리를 보내지 않는다.
 */
export function groupTimezonesByLocalClock(
  minute: Temporal.Instant,
  timezones: readonly string[],
): TimezoneContext[] {
  const locals = timezones.map((timezone) => ({
    timezone,
    local: minute.toZonedDateTimeISO(timezone).toPlainDateTime(),
    reminderTimes: reminderTimesDueAt(minute, timezone),
  }));
  const groups = groupBy(
    locals,
    ({ local, reminderTimes }) =>
      `${local.toPlainDate().toString()}|${local.hour}|${local.minute}|${local.dayOfWeek}|${reminderTimes.map(({ hour, minute: timeMinute }) => `${hour}:${timeMinute}`).join(",")}`,
  );
  return Object.values(groups).flatMap((group) => {
    const [first] = group;
    if (first == null) {
      return [];
    }
    return [
      contextOf({
        timezones: group.map(({ timezone }) => timezone),
        local: first.local,
        reminderTimes: first.reminderTimes,
      }),
    ];
  });
}

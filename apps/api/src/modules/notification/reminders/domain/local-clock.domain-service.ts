import { groupBy } from "es-toolkit";

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
  /** 로컬 요일 (0=일, 1=월, ...) */
  readonly dayOfWeek: number;
  /** 로컬 오늘 */
  readonly today: Temporal.PlainDate;
  /** 로컬 내일 */
  readonly tomorrow: Temporal.PlainDate;
  /** catch-up 발송 시 특정 유저만 대상 (없으면 전체 스윕) */
  readonly userId?: string;
}

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

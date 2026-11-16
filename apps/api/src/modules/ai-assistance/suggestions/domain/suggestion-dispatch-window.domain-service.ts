import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { toZonedInstant } from "#api/shared/domain/time/zoned-time";

import { SUGGESTION_ANALYSIS_PERIOD_DAYS } from "./suggestion.constants.js";

// 야간(21:00~08:00) 수신을 끈 사용자에게도 닿게 아침에 보낸다. 08시대는 기본 아침 알림과 겹쳐 09시대로 둔다
const SUGGESTION_DISPATCH_LOCAL_HOUR = 9;

// 빠진 매시 실행(배포·장애)을 같은 오전 안에서 따라잡는다. 같은 날 두 번은 현지 날짜 job key가 막는다
const SUGGESTION_DISPATCH_CATCH_UP_HOURS = 3;

interface SuggestionDispatchMoment {
  readonly at: Temporal.Instant;
  readonly timeZone: string;
}

// 아침 배치·지금 받기·상태가 같은 날짜를 보도록 시간대를 저장하지 않은 사용자는 모두 서울로 본다
export function resolveSuggestionTimeZone(storedTimeZone: string | null | undefined): string {
  return resolveTimezone(storedTimeZone ?? TimeZone.SEOUL.value);
}

export function isInSuggestionDispatchWindow(input: SuggestionDispatchMoment): boolean {
  const { hour } = input.at.toZonedDateTimeISO(input.timeZone);
  return (
    SUGGESTION_DISPATCH_LOCAL_HOUR <= hour &&
    hour < SUGGESTION_DISPATCH_LOCAL_HOUR + SUGGESTION_DISPATCH_CATCH_UP_HOURS
  );
}

export function suggestionDispatchLocalDate(input: SuggestionDispatchMoment): Temporal.PlainDate {
  return input.at.toZonedDateTimeISO(input.timeZone).toPlainDate();
}

export function nextSuggestionDispatchAt(input: SuggestionDispatchMoment): Temporal.Instant {
  const today = suggestionDispatchLocalDate(input);
  const dispatchAt = (date: Temporal.PlainDate) =>
    toZonedInstant({
      date,
      time: Temporal.PlainTime.from({ hour: SUGGESTION_DISPATCH_LOCAL_HOUR }),
      timeZone: TimeZone.create(input.timeZone),
    });
  const todayDispatchAt = dispatchAt(today);
  if (Temporal.Instant.compare(input.at, todayDispatchAt) < 0) {
    return todayDispatchAt;
  }
  return dispatchAt(today.add({ days: 1 }));
}

// 상태의 기록 수가 분석 결과와 어긋나지 않게 분석 문맥(SuggestionContextReader)과 같은 구간을 쓴다
export function suggestionAnalysisPeriod(input: SuggestionDispatchMoment): {
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
} {
  return {
    from: suggestionDispatchLocalDate({
      at: input.at.subtract({ hours: 24 * SUGGESTION_ANALYSIS_PERIOD_DAYS }),
      timeZone: input.timeZone,
    }),
    to: suggestionDispatchLocalDate(input),
  };
}

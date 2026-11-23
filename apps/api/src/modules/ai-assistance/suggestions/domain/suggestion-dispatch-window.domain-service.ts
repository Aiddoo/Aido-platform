import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";

import { resolveTimezone } from "#api/shared/domain/time/time-zone-name";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { toZonedInstant } from "#api/shared/domain/time/zoned-time";

import type { SuggestionAnalysisRun } from "./suggestion-analysis-run.entity.js";

// 야간(21:00~08:00) 수신을 끈 사용자에게도 닿게 아침에 보낸다. 08시대는 기본 아침 알림과 겹쳐 09시대로 둔다
const SUGGESTION_DISPATCH_LOCAL_HOUR = 9;

// 빠진 매시 실행(배포·장애)을 같은 오전 안에서 따라잡는다. 같은 날 두 번은 현지 날짜 job key가 막는다
const SUGGESTION_DISPATCH_CATCH_UP_HOURS = 3;

interface SuggestionDispatchMoment {
  readonly at: Temporal.Instant;
  readonly timeZone: string;
}

export interface SuggestionAnalysisPeriod {
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
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

// 오늘 요청 기록이 있으면 오늘 job key를 이미 써서 아침 배치가 건너뛰므로 다음 분석은 내일이다
export function nextSuggestionDispatchAt(
  input: SuggestionDispatchMoment & { readonly run: SuggestionAnalysisRun | null },
): Temporal.Instant {
  const today = suggestionDispatchLocalDate(input);
  // 배치는 UTC 매시 정각에만 돌아 +5:30·+5:45 같은 시간대는 현지 09:00 뒤 첫 정각(09:30·09:45)에 분석한다
  const dispatchAt = (date: Temporal.PlainDate) =>
    toZonedInstant({
      date,
      time: Temporal.PlainTime.from({ hour: SUGGESTION_DISPATCH_LOCAL_HOUR }),
      timeZone: TimeZone.create(input.timeZone),
    }).round({ smallestUnit: "hour", roundingMode: "ceil" });
  const todayDispatchAt = dispatchAt(today);
  const isTodayDispatchAhead = Temporal.Instant.compare(input.at, todayDispatchAt) < 0;
  if (isTodayDispatchAhead && !input.run?.isRequestedOn(today)) {
    return todayDispatchAt;
  }
  return dispatchAt(today.add({ days: 1 }));
}

// 상태·지금 받기의 할 일 수와 분석 문맥(GetSuggestionContextUseCase)이 어긋나지 않게 모두 이 구간을 센다
export function suggestionAnalysisPeriod(
  input: SuggestionDispatchMoment,
): SuggestionAnalysisPeriod {
  return {
    from: suggestionDispatchLocalDate({
      at: input.at.subtract({ hours: 24 * AI_SUGGESTION_LIMITS.ANALYSIS_PERIOD_DAYS }),
      timeZone: input.timeZone,
    }),
    to: suggestionDispatchLocalDate(input),
  };
}

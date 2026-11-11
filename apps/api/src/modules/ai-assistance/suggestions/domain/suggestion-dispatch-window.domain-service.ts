/** 반복 제안을 보내는 사용자 현지 시각(07시대) */
const SUGGESTION_DISPATCH_LOCAL_HOUR = 7;

/**
 * 07시대에 빠진 매시 실행(배포·장애)을 같은 아침 안에서 따라잡는 시간. 평소에는 07시대 실행이 보내고,
 * 그 뒤 실행은 사용자 현지 날짜 키가 막아 같은 날 두 번 보내지 않는다.
 */
const SUGGESTION_DISPATCH_CATCH_UP_HOURS = 3;

/** at에 사용자 현지 시각이 제안 창(07:00 이상 10:00 미만)인지 */
export function isInSuggestionDispatchWindow(input: {
  readonly at: Temporal.Instant;
  readonly timeZone: string;
}): boolean {
  const { hour } = input.at.toZonedDateTimeISO(input.timeZone);
  return (
    hour >= SUGGESTION_DISPATCH_LOCAL_HOUR &&
    hour < SUGGESTION_DISPATCH_LOCAL_HOUR + SUGGESTION_DISPATCH_CATCH_UP_HOURS
  );
}

/** 사용자 현지 날짜(YYYY-MM-DD). 하루 한 번 분석하는 멱등 키에 쓴다 */
export function suggestionDispatchLocalDate(input: {
  readonly at: Temporal.Instant;
  readonly timeZone: string;
}): string {
  return input.at.toZonedDateTimeISO(input.timeZone).toPlainDate().toString();
}

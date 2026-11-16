// 야간(21:00~08:00) 수신을 끈 사용자에게도 닿게 아침에 보낸다. 08시대는 기본 아침 알림과 겹쳐 09시대로 둔다
const SUGGESTION_DISPATCH_LOCAL_HOUR = 9;

// 빠진 매시 실행(배포·장애)을 같은 오전 안에서 따라잡는다. 같은 날 두 번은 현지 날짜 job key가 막는다
const SUGGESTION_DISPATCH_CATCH_UP_HOURS = 3;

export function isInSuggestionDispatchWindow(input: {
  readonly at: Temporal.Instant;
  readonly timeZone: string;
}): boolean {
  const { hour } = input.at.toZonedDateTimeISO(input.timeZone);
  return (
    SUGGESTION_DISPATCH_LOCAL_HOUR <= hour &&
    hour < SUGGESTION_DISPATCH_LOCAL_HOUR + SUGGESTION_DISPATCH_CATCH_UP_HOURS
  );
}

export function suggestionDispatchLocalDate(input: {
  readonly at: Temporal.Instant;
  readonly timeZone: string;
}): string {
  return input.at.toZonedDateTimeISO(input.timeZone).toPlainDate().toString();
}

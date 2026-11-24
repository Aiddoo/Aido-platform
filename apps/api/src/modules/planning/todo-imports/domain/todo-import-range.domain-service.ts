export type TodoImportRangeJudgement =
  | { readonly kind: "withinHorizon" }
  | { readonly kind: "endBeforeStart" }
  | { readonly kind: "startBeforeToday" }
  | { readonly kind: "beyondHorizon"; readonly lastAllowedDate: Temporal.PlainDate };

/**
 * 가져올 기간이 오늘부터 요금제 일 수 안에 드는지. 오늘은 가져오기 시간대의 달력 날짜이고
 * 일 수는 오늘을 포함해 센다(30일이면 오늘 + 29일까지).
 */
export function judgeImportRange(params: {
  readonly today: Temporal.PlainDate;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
  readonly horizonDays: number;
}): TodoImportRangeJudgement {
  const { today, startDate, endDate, horizonDays } = params;
  if (Temporal.PlainDate.compare(endDate, startDate) < 0) {
    return { kind: "endBeforeStart" };
  }
  if (Temporal.PlainDate.compare(startDate, today) < 0) {
    return { kind: "startBeforeToday" };
  }
  const lastAllowedDate = today.add({ days: horizonDays - 1 });
  if (Temporal.PlainDate.compare(endDate, lastAllowedDate) > 0) {
    return { kind: "beyondHorizon", lastAllowedDate };
  }
  return { kind: "withinHorizon" };
}

/** 받은 일정의 시작 날짜가 가져올 기간 안인지. 여러 날 일정은 시작 날짜만 본다 */
export function isWithinImportRange(params: {
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
  readonly date: Temporal.PlainDate;
}): boolean {
  const { startDate, endDate, date } = params;
  return (
    Temporal.PlainDate.compare(startDate, date) <= 0 &&
    Temporal.PlainDate.compare(date, endDate) <= 0
  );
}

/** 만든 할 일 중 가장 이른 날짜를 이어서 센다 */
export function earlierDate(
  current: Temporal.PlainDate | null,
  candidate: Temporal.PlainDate | null,
): Temporal.PlainDate | null {
  if (current == null || candidate == null) {
    return current ?? candidate;
  }
  return Temporal.PlainDate.compare(candidate, current) < 0 ? candidate : current;
}

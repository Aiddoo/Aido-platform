/** 콕을 찌를 수 있는지 판단하는 할 일 값 */
export interface NudgeableTodo {
  readonly completed: boolean;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
}

// 기간 할 일은 시작·종료일 사이, 하루 할 일은 시작일 당일이다
function isActiveOn(todo: NudgeableTodo, date: Temporal.PlainDate): boolean {
  const { startDate, endDate } = todo;
  if (endDate == null) {
    return startDate.equals(date);
  }
  return (
    Temporal.PlainDate.compare(startDate, date) <= 0 &&
    Temporal.PlainDate.compare(date, endDate) <= 0
  );
}

/** 끝내지 않은 그날 할 일만 찌를 수 있다. 콕 보내기와 할 일 상세의 canNudge가 함께 쓴다 */
export function canNudgeTodoOn(todo: NudgeableTodo, date: Temporal.PlainDate): boolean {
  return !todo.completed && isActiveOn(todo, date);
}

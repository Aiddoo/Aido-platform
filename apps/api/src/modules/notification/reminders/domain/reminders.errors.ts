// 날짜 키로 만든 PlainDate는 ISO 달력이라 주차가 늘 있다. 없으면 코드가 어긋난 것이다
export function nonIsoCalendarDate(date: Temporal.PlainDate): Error {
  return new Error(`Not an ISO calendar date: ${date.toString()}`);
}

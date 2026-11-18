/** ISO 달력이 아닌 날짜는 ISO 주차를 셀 수 없다. 서버는 ISO 달력만 쓰므로 코드 버그다 */
export function nonIsoWeekDate(): RangeError {
  return new RangeError("Only ISO calendar dates have an ISO week number");
}

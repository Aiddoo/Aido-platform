interface WeekRangeDay {
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
}

/** 한 주의 기간 띠가 차지하는 구간(주 폭에 대한 0..1). 시작·끝 날은 칸 가운데까지만 칠한다. 띠가 없으면 null이다 */
export function findWeekRangeBand(
  days: readonly WeekRangeDay[],
): { startRatio: number; endRatio: number } | null {
  const spans = days.flatMap<[start: number, end: number]>(
    ({ isInRange, isRangeStart, isRangeEnd }, index) => {
      if (isInRange) {
        return [[index, index + 1]];
      }
      if (isRangeStart) {
        return [[index + 0.5, index + 1]];
      }
      return isRangeEnd ? [[index, index + 0.5]] : [];
    },
  );
  const [first] = spans;
  const last = spans.at(-1);
  if (first == null || last == null) {
    return null;
  }

  return { startRatio: first[0] / days.length, endRatio: last[1] / days.length };
}

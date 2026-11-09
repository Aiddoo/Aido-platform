interface ClockTimeLike {
  hour: number;
  minute: number;
}

function toMinutesOfDay({ hour, minute }: ClockTimeLike) {
  return hour * 60 + minute;
}

/** 시와 분이 `minimumTime` 이상 `maximumTime` 이하인지. 둘 다 그날 안의 시각이다 */
export function isClockTimeInRange(
  time: ClockTimeLike,
  { minimumTime, maximumTime }: { minimumTime: ClockTimeLike; maximumTime: ClockTimeLike },
): boolean {
  return (
    toMinutesOfDay(minimumTime) <= toMinutesOfDay(time) &&
    toMinutesOfDay(time) <= toMinutesOfDay(maximumTime)
  );
}

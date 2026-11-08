interface ClockTimeLike {
  hour: number;
  minute: number;
}

function toMinutesOfDay({ hour, minute }: ClockTimeLike) {
  return hour * 60 + minute;
}

export function isClockTimeInRange(
  time: ClockTimeLike,
  { minimumTime, maximumTime }: { minimumTime: ClockTimeLike; maximumTime: ClockTimeLike },
): boolean {
  return (
    toMinutesOfDay(minimumTime) <= toMinutesOfDay(time) &&
    toMinutesOfDay(time) <= toMinutesOfDay(maximumTime)
  );
}

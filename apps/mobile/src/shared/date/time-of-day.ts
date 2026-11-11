import { timeOfDaySchema } from '@aido/api/common';

const MINUTES_PER_HOUR = 60;

/** 시간대와 무관한 하루 중 시각 (0-23시, 0-59분). 서버 `HH:mm`은 `toTimeOfDay`로 읽는다 */
export interface TimeOfDay {
  hour: number;
  minute: number;
}

export function isValidHHmm(time: string): boolean {
  return timeOfDaySchema.safeParse(time).success;
}

/** 검증한 `HH:mm`을 시와 분으로 나눈다 */
export function toTimeOfDay(time: string): TimeOfDay {
  const [hour, minute] = time.split(':');
  return { hour: Number(hour), minute: Number(minute) };
}

function toMinutesOfDay({ hour, minute }: TimeOfDay): number {
  return hour * MINUTES_PER_HOUR + minute;
}

/** 시와 분이 `minimumTime` 이상 `maximumTime` 이하인지. 둘 다 그날 안의 시각이다 */
export function isTimeOfDayInRange(
  time: TimeOfDay,
  { minimumTime, maximumTime }: { minimumTime: TimeOfDay; maximumTime: TimeOfDay },
): boolean {
  return (
    toMinutesOfDay(minimumTime) <= toMinutesOfDay(time) &&
    toMinutesOfDay(time) <= toMinutesOfDay(maximumTime)
  );
}

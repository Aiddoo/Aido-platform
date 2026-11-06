import { z } from 'zod';

/** 앱이 마지막으로 알아챈 기기 시간대. 오프셋은 바뀐 폭을 재는 데만 쓴다 */
export const deviceTimezoneSchema = z.object({
  timeZone: z.string().min(1),
  offsetMinutes: z.int(),
});
export type DeviceTimezone = z.infer<typeof deviceTimezoneSchema>;

export interface DeviceTimezoneChange {
  previous: DeviceTimezone;
  current: DeviceTimezone;
}

export type TimezoneOffsetBucket = 'same' | 'under_3h' | '3h_to_8h' | '8h_plus';

const MINUTES_PER_HOUR = 60;

function hasDeviceTimezoneChanged(previous: DeviceTimezone, current: DeviceTimezone): boolean {
  return previous.timeZone !== current.timeZone;
}

/** 서울 ↔ 도쿄처럼 이름만 바뀌면 알림 시각이 그대로라 알릴 일이 없다 */
function isOffsetChanged({ previous, current }: DeviceTimezoneChange): boolean {
  return previous.offsetMinutes !== current.offsetMinutes;
}

function getTimezoneOffsetBucket({
  previous,
  current,
}: DeviceTimezoneChange): TimezoneOffsetBucket {
  const hours = Math.abs(current.offsetMinutes - previous.offsetMinutes) / MINUTES_PER_HOUR;
  if (hours === 0) {
    return 'same';
  }
  if (hours < 3) {
    return 'under_3h';
  }
  return hours < 8 ? '3h_to_8h' : '8h_plus';
}

export const DeviceTimezonePolicy = {
  hasDeviceTimezoneChanged,
  isOffsetChanged,
  getTimezoneOffsetBucket,
} as const;

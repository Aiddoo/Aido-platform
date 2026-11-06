import type {
  DeviceTimezone,
  DeviceTimezoneChange,
  TimezoneOffsetBucket,
} from '../schemas/device-timezone.schema';

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

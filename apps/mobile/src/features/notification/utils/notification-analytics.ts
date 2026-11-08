import type { DeviceTimezoneChange, TimezoneOffsetBucket } from '../domains/device-timezone.model';

const MINUTES_PER_HOUR = 60;

export function getTimezoneOffsetBucket({
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

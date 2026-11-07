import type { DeviceTimezone, DeviceTimezoneChange } from '../schemas/device-timezone.schema';

function hasDeviceTimezoneChanged(previous: DeviceTimezone, current: DeviceTimezone): boolean {
  return previous.timeZone !== current.timeZone;
}

/** 서울 ↔ 도쿄처럼 이름만 바뀌면 알림 시각이 그대로라 알릴 일이 없다 */
function hasOffsetChanged({ previous, current }: DeviceTimezoneChange): boolean {
  return previous.offsetMinutes !== current.offsetMinutes;
}

export const DeviceTimezonePolicy = {
  hasDeviceTimezoneChanged,
  hasOffsetChanged,
} as const;

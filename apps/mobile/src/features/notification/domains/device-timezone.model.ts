import { z } from 'zod';

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

function hasDeviceTimezoneChanged(previous: DeviceTimezone, current: DeviceTimezone): boolean {
  return previous.timeZone !== current.timeZone;
}

function hasOffsetChanged({ previous, current }: DeviceTimezoneChange): boolean {
  return previous.offsetMinutes !== current.offsetMinutes;
}

export const DeviceTimezonePolicy = {
  hasDeviceTimezoneChanged,
  hasOffsetChanged,
} as const;

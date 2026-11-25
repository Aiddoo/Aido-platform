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

export const DeviceTimezonePolicy = {
  hasDeviceTimezoneChanged(previous: DeviceTimezone, current: DeviceTimezone): boolean {
    return previous.timeZone !== current.timeZone;
  },

  /** 서울 ↔ 도쿄처럼 이름만 바뀌면 알림 시각이 그대로라 알릴 일이 없다 */
  hasOffsetChanged({ previous, current }: DeviceTimezoneChange): boolean {
    return previous.offsetMinutes !== current.offsetMinutes;
  },
};

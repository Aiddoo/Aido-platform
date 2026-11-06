import { z } from 'zod';

/** 앱이 마지막으로 알아챈 기기 시간대. 오프셋은 바뀐 폭을 재는 데만 쓴다 */
const deviceTimezoneSchema = z.object({
  timeZone: z.string().min(1),
  offsetMinutes: z.int(),
});
export type DeviceTimezone = z.infer<typeof deviceTimezoneSchema>;

export const savedDeviceTimezoneSchema = z.object({
  userId: z.string(),
  deviceTimezone: deviceTimezoneSchema,
});

export interface DeviceTimezoneChange {
  previous: DeviceTimezone;
  current: DeviceTimezone;
}

export type TimezoneOffsetBucket = 'same' | 'under_3h' | '3h_to_8h' | '8h_plus';

import type { DeviceTimezone } from '../schemas/device-timezone.schema';
import { getTimezoneOffsetBucket } from './notification-analytics';

const SEOUL: DeviceTimezone = { timeZone: 'Asia/Seoul', offsetMinutes: 540 };
const TOKYO: DeviceTimezone = { timeZone: 'Asia/Tokyo', offsetMinutes: 540 };
const SINGAPORE: DeviceTimezone = { timeZone: 'Asia/Singapore', offsetMinutes: 480 };
const LONDON: DeviceTimezone = { timeZone: 'Europe/London', offsetMinutes: 60 };
const NEW_YORK: DeviceTimezone = { timeZone: 'America/New_York', offsetMinutes: -240 };
const DUBAI: DeviceTimezone = { timeZone: 'Asia/Dubai', offsetMinutes: 240 };

describe('getTimezoneOffsetBucket', () => {
  it.each([
    [SEOUL, TOKYO, 'same'],
    [SEOUL, SINGAPORE, 'under_3h'],
    [SEOUL, DUBAI, '3h_to_8h'],
    [SEOUL, LONDON, '8h_plus'],
    [NEW_YORK, SEOUL, '8h_plus'],
  ] as const)('%j → %j의 오프셋 차이 구간은 %s다', (previous, current, bucket) => {
    // When
    const result = getTimezoneOffsetBucket({ previous, current });

    // Then
    expect(result).toBe(bucket);
  });
});

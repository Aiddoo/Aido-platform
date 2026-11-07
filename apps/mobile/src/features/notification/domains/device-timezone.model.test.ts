import type { DeviceTimezone } from '../schemas/device-timezone.schema';
import { DeviceTimezonePolicy } from './device-timezone.model';

const SEOUL: DeviceTimezone = { timeZone: 'Asia/Seoul', offsetMinutes: 540 };
const TOKYO: DeviceTimezone = { timeZone: 'Asia/Tokyo', offsetMinutes: 540 };
const NEW_YORK: DeviceTimezone = { timeZone: 'America/New_York', offsetMinutes: -240 };

describe('DeviceTimezonePolicy', () => {
  it('이름만 다른 시간대는 바뀌었지만 알릴 만큼 오프셋이 달라지지 않았다', () => {
    // Given
    const change = { previous: SEOUL, current: TOKYO };

    // When
    const changed = DeviceTimezonePolicy.hasDeviceTimezoneChanged(SEOUL, TOKYO);
    const offsetChanged = DeviceTimezonePolicy.isOffsetChanged(change);

    // Then
    expect(changed).toBe(true);
    expect(offsetChanged).toBe(false);
  });

  it('같은 시간대의 서머타임 전환은 바뀐 것으로 보지 않는다', () => {
    // Given
    const winter: DeviceTimezone = { timeZone: 'America/New_York', offsetMinutes: -300 };

    // When
    const changed = DeviceTimezonePolicy.hasDeviceTimezoneChanged(winter, NEW_YORK);

    // Then
    expect(changed).toBe(false);
  });
});

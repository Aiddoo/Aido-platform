import type { DeviceTimezone } from '../schemas/device-timezone.schema';
import { DeviceTimezonePolicy } from './device-timezone.model';

const SEOUL: DeviceTimezone = { timeZone: 'Asia/Seoul', offsetMinutes: 540 };
const TOKYO: DeviceTimezone = { timeZone: 'Asia/Tokyo', offsetMinutes: 540 };
const NEW_YORK: DeviceTimezone = { timeZone: 'America/New_York', offsetMinutes: -240 };
const NEW_YORK_WINTER: DeviceTimezone = { timeZone: 'America/New_York', offsetMinutes: -300 };

describe('hasDeviceTimezoneChanged', () => {
  it('시간대 이름이 다르면 바뀐 것으로 본다', () => {
    // When
    const changed = DeviceTimezonePolicy.hasDeviceTimezoneChanged(SEOUL, TOKYO);

    // Then
    expect(changed).toBe(true);
  });

  it('같은 시간대의 서머타임 전환은 바뀐 것으로 보지 않는다', () => {
    // When
    const changed = DeviceTimezonePolicy.hasDeviceTimezoneChanged(NEW_YORK_WINTER, NEW_YORK);

    // Then
    expect(changed).toBe(false);
  });
});

describe('isOffsetChanged', () => {
  it('이름만 다른 시간대는 알림 시각이 그대로라 오프셋이 달라지지 않았다', () => {
    // When
    const offsetChanged = DeviceTimezonePolicy.isOffsetChanged({ previous: SEOUL, current: TOKYO });

    // Then
    expect(offsetChanged).toBe(false);
  });

  it('다른 대륙으로 옮겨 오프셋이 달라지면 알릴 일이다', () => {
    // When
    const offsetChanged = DeviceTimezonePolicy.isOffsetChanged({
      previous: SEOUL,
      current: NEW_YORK,
    });

    // Then
    expect(offsetChanged).toBe(true);
  });
});

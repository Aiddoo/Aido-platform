import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';

import { getSunArcPosition, isSunBelowHorizon } from './sun-arc.geometry';

const SUNRISE = toInstant('2026-11-01T21:51:00.000Z');
const SUNSET = toInstant('2026-11-02T08:28:00.000Z');
const DAY = { sunrise: SUNRISE, sunset: SUNSET };

describe('getSunArcPosition', () => {
  it('일출·한낮·일몰에 궤적의 왼쪽 지평선·꼭대기·오른쪽 지평선에 있다', () => {
    // Given
    const noon = fromEpochMs((toEpochMs(SUNRISE) + toEpochMs(SUNSET)) / 2);

    // When
    const atSunrise = getSunArcPosition(DAY, SUNRISE);
    const atNoon = getSunArcPosition(DAY, noon);
    const atSunset = getSunArcPosition(DAY, SUNSET);

    // Then
    expect(atSunrise).toEqual({ x: 58, y: 70 });
    expect(atNoon).toEqual({ x: 163, y: 14 });
    expect(atSunset).toEqual({ x: 268, y: 70 });
  });

  it('밤에는 지평선 아래 양 끝 곡선 위에 있다', () => {
    // Given
    const lateNight = fromEpochMs(toEpochMs(SUNSET) + 12 * 3_600_000);
    const justBeforeSunrise = fromEpochMs(toEpochMs(SUNRISE) - 60_000);

    // When
    const position = getSunArcPosition(DAY, lateNight);
    const beforeSunrisePosition = getSunArcPosition(DAY, justBeforeSunrise);

    // Then
    expect(position).toEqual({ x: 326, y: 84 });
    expect(beforeSunrisePosition?.y).toBeGreaterThan(70);
  });

  it('일출이나 일몰이 없으면 자리를 정하지 않는다', () => {
    // When
    const position = getSunArcPosition({ sunrise: null, sunset: null }, SUNRISE);

    // Then
    expect(position).toBeNull();
  });
});

describe('isSunBelowHorizon', () => {
  it('일출 전과 일몰 뒤에만 해가 지평선 아래에 있다', () => {
    // Given
    const beforeSunrise = fromEpochMs(toEpochMs(SUNRISE) - 60_000);
    const beforeSunset = fromEpochMs(toEpochMs(SUNSET) - 60_000);
    const afterSunset = fromEpochMs(toEpochMs(SUNSET) + 60_000);

    // When
    const results = [beforeSunrise, beforeSunset, afterSunset].map((at) =>
      isSunBelowHorizon(DAY, at),
    );

    // Then
    expect(results).toEqual([true, false, true]);
  });
});

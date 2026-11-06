import { getSunArcPosition, isSunBelowHorizon } from './sun-arc.geometry';

const SUNRISE = new Date('2026-11-01T21:51:00.000Z');
const SUNSET = new Date('2026-11-02T08:28:00.000Z');
const DAY = { sunrise: SUNRISE, sunset: SUNSET };

describe('getSunArcPosition', () => {
  it('일출·한낮·일몰에 궤적의 왼쪽 지평선·꼭대기·오른쪽 지평선에 있다', () => {
    // Given 일출·정오·일몰 시각 When 해 자리를 구하면 Then 시안 궤적의 세 점이다
    const noon = new Date((SUNRISE.getTime() + SUNSET.getTime()) / 2);

    expect(getSunArcPosition(DAY, SUNRISE)).toEqual({ x: 58, y: 70 });
    expect(getSunArcPosition(DAY, noon)).toEqual({ x: 163, y: 14 });
    expect(getSunArcPosition(DAY, SUNSET)).toEqual({ x: 268, y: 70 });
  });

  it('밤에는 지평선 아래 양 끝 곡선 위에 있다', () => {
    // Given 일몰 뒤 오래·일출 직전 When 해 자리를 구하면 Then 오른쪽 끝·왼쪽 지평선 근처다
    const lateNight = new Date(SUNSET.getTime() + 12 * 3_600_000);
    const position = getSunArcPosition(DAY, lateNight);

    expect(position).toEqual({ x: 326, y: 84 });
    expect(getSunArcPosition(DAY, new Date(SUNRISE.getTime() - 60_000))?.y).toBeGreaterThan(70);
  });

  it('일출이나 일몰이 없으면 자리를 정하지 않는다', () => {
    // Given 극야 When 해 자리를 구하면 Then null이다
    expect(getSunArcPosition({ sunrise: null, sunset: null }, SUNRISE)).toBeNull();
  });
});

describe('isSunBelowHorizon', () => {
  it('일출 전과 일몰 뒤에만 해가 지평선 아래에 있다', () => {
    // Given 일출 전·한낮·일몰 뒤 When 해가 졌는지 보면 Then 밤에만 참이다
    expect(isSunBelowHorizon(DAY, new Date(SUNRISE.getTime() - 60_000))).toBe(true);
    expect(isSunBelowHorizon(DAY, new Date(SUNSET.getTime() - 60_000))).toBe(false);
    expect(isSunBelowHorizon(DAY, new Date(SUNSET.getTime() + 60_000))).toBe(true);
  });
});

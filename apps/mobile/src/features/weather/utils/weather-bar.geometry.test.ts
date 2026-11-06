import { createWeatherReport } from '../__tests__/weather-report.factories';
import {
  toAirMeterPosition,
  toTemperatureBars,
  toTemperaturePosition,
  toUvMeterPosition,
} from './weather-bar.geometry';

describe('막대 위치', () => {
  it.each([
    [0, 0.03],
    [4, 4 / 11],
    [15, 0.97],
  ])('자외선 %d은 막대의 %f 위치다', (uvIndex, expected) => {
    // Given 자외선 지수 When 막대 위치를 구하면 Then 3%~97% 안에서 11 기준 비율이다
    expect(toUvMeterPosition(uvIndex)).toBeCloseTo(expected);
  });

  it.each([
    ['pm10', 15, 0.125],
    ['pm10', 80, 0.5],
    ['pm25', 25, 0.375],
    ['pm25', 500, 0.97],
  ] as const)('%s %d은 막대의 %f 위치다', (pollutant, value, expected) => {
    // Given 오염물질 농도 When 막대 위치를 구하면 Then 등급 칸 안에서 비례한 위치다
    expect(toAirMeterPosition(value, pollutant)).toBeCloseTo(expected);
  });
});

describe('toTemperatureBars', () => {
  it('예보 기간 전체의 최저~최고 안에서 하루의 위치를 0~1로 둔다', () => {
    // Given
    const [day] = createWeatherReport().daily;
    const days =
      day == null
        ? []
        : [
            { ...day, temperatureMin: 0, temperatureMax: 10 },
            { ...day, temperatureMin: 5, temperatureMax: 20 },
          ];

    // When
    const bars = toTemperatureBars(days);

    // Then
    expect(bars).toEqual([
      { start: 0, end: 0.5 },
      { start: 0.25, end: 1 },
    ]);
  });

  it('예보가 없으면 막대를 만들지 않는다', () => {
    // When
    const bars = toTemperatureBars([]);

    // Then
    expect(bars).toEqual([]);
  });
});

describe('toTemperaturePosition', () => {
  it('예보 기간 최저~최고 사이에서 지금 기온의 위치를 0~1로 반환한다', () => {
    // Given 최저 8° 최고 14° When 11°의 위치를 구하면 Then 가운데다
    const { daily } = createWeatherReport();

    expect(toTemperaturePosition(daily, 11)).toBe(0.5);
  });

  it('범위를 벗어난 기온은 양 끝에 붙인다', () => {
    // Given 최저 8° 최고 14° When 20°의 위치를 구하면 Then 1이다
    const { daily } = createWeatherReport();

    expect(toTemperaturePosition(daily, 20)).toBe(1);
  });

  it('예보가 없으면 null을 반환한다', () => {
    // Given 빈 예보 When 위치를 구하면 Then null이다
    expect(toTemperaturePosition([], 11)).toBeNull();
  });
});

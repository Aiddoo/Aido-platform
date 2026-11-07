import { createWeatherReport } from '../__tests__/weather-report.fixtures';
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
    // When
    const position = toUvMeterPosition(uvIndex);

    // Then
    expect(position).toBeCloseTo(expected);
  });

  it.each([
    ['pm10', 15, 0.125],
    ['pm10', 80, 0.5],
    ['pm25', 25, 0.375],
    ['pm25', 500, 0.97],
  ] as const)('%s %d은 막대의 %f 위치다', (pollutant, value, expected) => {
    // When
    const position = toAirMeterPosition(value, pollutant);

    // Then
    expect(position).toBeCloseTo(expected);
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
    // Given
    const { daily } = createWeatherReport();

    // When
    const position = toTemperaturePosition(daily, 11);

    // Then
    expect(position).toBe(0.5);
  });

  it('범위를 벗어난 기온은 양 끝에 붙인다', () => {
    // Given
    const { daily } = createWeatherReport();

    // When
    const position = toTemperaturePosition(daily, 20);

    // Then
    expect(position).toBe(1);
  });

  it('예보가 없으면 null을 반환한다', () => {
    // When
    const position = toTemperaturePosition([], 11);

    // Then
    expect(position).toBeNull();
  });
});

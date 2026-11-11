import {
  createAirQuality,
  createCurrentWeather,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { WeatherIndicatorPolicy } from './weather-indicator.model';

describe('getPollutantGrade', () => {
  it.each([
    ['pm10', 30, 'good'],
    ['pm10', 31, 'moderate'],
    ['pm10', 80, 'moderate'],
    ['pm10', 81, 'bad'],
    ['pm10', 151, 'veryBad'],
    ['pm25', 15, 'good'],
    ['pm25', 16, 'moderate'],
    ['pm25', 36, 'bad'],
    ['pm25', 76, 'veryBad'],
  ] as const)('%s가 %s μg/m³이면 %s 등급이다', (pollutant, value, expected) => {
    // Given
    const airQuality = createAirQuality(pollutant === 'pm10' ? { pm10: value } : { pm25: value });

    // When
    const grade = WeatherIndicatorPolicy.getPollutantGrade(airQuality, pollutant);

    // Then
    expect(grade).toBe(expected);
  });

  it('고른 오염 물질의 값이 없으면 다른 물질이 나빠도 null이다', () => {
    // Given
    const airQuality = createAirQuality({ pm10: 200, pm25: null });

    // When
    const grade = WeatherIndicatorPolicy.getPollutantGrade(airQuality, 'pm25');

    // Then
    expect(grade).toBeNull();
  });

  it('고른 오염 물질만 보고 다른 물질의 값은 등급에 섞지 않는다', () => {
    // Given
    const airQuality = createAirQuality({ pm10: 200, pm25: 10 });

    // When
    const grade = WeatherIndicatorPolicy.getPollutantGrade(airQuality, 'pm25');

    // Then
    expect(grade).toBe('good');
  });
});

describe('getUvLevel', () => {
  it.each([
    [0, 'low'],
    [2, 'low'],
    [3, 'moderate'],
    [5, 'moderate'],
    [6, 'high'],
    [7, 'high'],
    [8, 'veryHigh'],
    [10, 'veryHigh'],
    [11, 'extreme'],
  ] as const)('자외선 지수 %s는 %s 단계다', (uvIndex, expected) => {
    // When
    const level = WeatherIndicatorPolicy.getUvLevel(createCurrentWeather({ uvIndex }));

    // Then
    expect(level).toBe(expected);
  });
});

describe('getCompassDirection', () => {
  it.each([
    [0, 'n'],
    [22, 'n'],
    [23, 'ne'],
    [315, 'nw'],
    [337, 'nw'],
    [338, 'n'],
    [359, 'n'],
    [-45, 'nw'],
    [null, null],
  ] as const)('풍향 %s도는 %s 방위로 보여 준다', (windDirection, expected) => {
    // When
    const direction = WeatherIndicatorPolicy.getCompassDirection(
      createCurrentWeather({ windDirection }),
    );

    // Then
    expect(direction).toBe(expected);
  });
});

describe('getFeelsLikeComparison', () => {
  it.each([
    [12, 9.9, 'colder'],
    [12, 10.1, 'similar'],
    [12, 14, 'warmer'],
  ] as const)(
    '기온 %s°, 체감 %s°이면 %s로 안내한다',
    (temperature, apparentTemperature, expected) => {
      // Given
      const { current } = createWeatherReport();

      // When
      const comparison = WeatherIndicatorPolicy.getFeelsLikeComparison({
        ...current,
        temperature,
        apparentTemperature,
      });

      // Then
      expect(comparison).toBe(expected);
    },
  );
});

describe('getVisibilityLevel', () => {
  it.each([
    [16_000, 'clear'],
    [10_000, 'clear'],
    [9_999, 'moderate'],
    [5_000, 'moderate'],
    [1_240, 'poor'],
  ] as const)('가시거리 %dm는 %s다', (meters, expected) => {
    // When
    const level = WeatherIndicatorPolicy.getVisibilityLevel(
      createCurrentWeather({ visibility: meters }),
    );

    // Then
    // 10km 이상은 맑음, 5km 이상은 보통, 그 아래는 나쁨이다
    expect(level).toBe(expected);
  });
});

describe('getCloudCoverLevel', () => {
  it.each([
    [95, 'overcast'],
    [80, 'overcast'],
    [79, 'mostlyCloudy'],
    [40, 'mostlyCloudy'],
    [10, 'mostlyClear'],
  ] as const)('운량 %d%%는 %s다', (cloudCover, expected) => {
    // When
    const level = WeatherIndicatorPolicy.getCloudCoverLevel(createCurrentWeather({ cloudCover }));

    // Then
    // 80% 이상은 흐림, 40% 이상은 구름 많음, 그 아래는 대체로 맑음이다
    expect(level).toBe(expected);
  });
});

describe('getWindLevel', () => {
  it.each([
    [0.7, 'calm'],
    [1.4, 'calm'],
    [1.5, 'breeze'],
    [3, 'breeze'],
    [5.4, 'breeze'],
    [5.5, 'strong'],
    [8, 'strong'],
  ] as const)('풍속 %s m/s는 %s 바람이다', (speed, expected) => {
    // When
    const level = WeatherIndicatorPolicy.getWindLevel(createCurrentWeather({ windSpeed: speed }));

    // Then
    // 1.5m/s 미만은 잔잔, 5.5m/s 이상은 강하다 (보퍼트 풍력 1·4)
    expect(level).toBe(expected);
  });
});

describe('isMuggy', () => {
  it.each([
    [79, false],
    [80, true],
  ])('상대 습도 %s%%이면 눅눅한지는 %s다', (humidity, expected) => {
    // When
    const muggy = WeatherIndicatorPolicy.isMuggy(createCurrentWeather({ humidity }));

    // Then
    expect(muggy).toBe(expected);
  });
});

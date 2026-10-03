import { weatherForecastSchema } from '../../models/weather.model';
import { createWeatherClock } from './weather-clock.view-model';
import { toWeatherForecastViewModel } from './weather-forecast.view-model';

const createForecast = () =>
  weatherForecastSchema.parse({
    latitude: 37.5,
    longitude: 127,
    date: new Date('2026-10-03T00:00:00Z'),
    skyCondition: 'CLEAR',
    precipitationType: 'NONE',
    precipitationProbability: 0,
    temperatureMin: -5,
    temperatureMax: 15,
    humidity: 52,
    windSpeed: 1.7,
    hourlyForecasts: [],
  });

describe('날씨 표시 데이터', () => {
  test.each([-3, 0, 23])('기온 %s도를 빈 값으로 처리하지 않는다', (temperature) => {
    // Given
    const forecast = createForecast();
    forecast.hourlyForecasts = [
      {
        hour: 16,
        temperature,
        skyCondition: 'CLEAR',
        precipitationProbability: 0,
        precipitationAmount: 0,
        snowAmount: 0,
      },
    ];
    // When
    const result = toWeatherForecastViewModel(forecast, 16);
    // Then
    expect(result.currentTemperature).toBe(temperature);
  });

  test('시간별 예보가 없으면 최고·최저 평균을 현재 기온으로 표시하지 않는다', () => {
    // Given
    const forecast = createForecast();
    // When
    const result = toWeatherForecastViewModel(forecast, 16);
    // Then
    expect(result.currentTemperature).toBeNull();
    expect(result.temperatureMin).toBe(-5);
    expect(result.temperatureMax).toBe(15);
  });

  test('기기 시간대와 관계없이 기상청 예보 날짜와 시간은 한국 기준으로 계산한다', () => {
    // Given
    const now = new Date('2026-10-03T15:05:00Z');
    // When
    const clock = createWeatherClock(now);
    // Then
    expect(clock.date).toBe('2026-10-04');
    expect(clock.hour).toBe(0);
  });
});

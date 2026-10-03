import { hourlyForecastSchema } from '../../models/weather.model';
import { toUpcomingHourlyForecasts } from './hourly-forecast.view-model';

const createForecast = (hour: number) =>
  hourlyForecastSchema.parse({
    hour,
    temperature: 18,
    skyCondition: 'CLEAR',
    precipitationProbability: 0,
    precipitationAmount: 0,
    snowAmount: 0,
  });

describe('시간별 예보의 날짜 구분', () => {
  test('오늘 지나간 시각은 제외하고 내일 새벽 예보는 유지한다', () => {
    // Given
    const forecasts = [21, 22, 23, 0, 1].map(createForecast);

    // When
    const result = toUpcomingHourlyForecasts(forecasts, 22);

    // Then
    expect(result.map(({ hour, dayOffset }) => ({ hour, dayOffset }))).toEqual([
      { hour: 22, dayOffset: 0 },
      { hour: 23, dayOffset: 0 },
      { hour: 0, dayOffset: 1 },
      { hour: 1, dayOffset: 1 },
    ]);
  });

  test('오늘과 내일의 같은 시각에 서로 다른 식별자를 부여한다', () => {
    // Given
    const forecasts = [22, 23, 0, 22, 23].map(createForecast);

    // When
    const result = toUpcomingHourlyForecasts(forecasts, 22);

    // Then
    expect(result.map(({ id }) => id)).toEqual(['0-22', '0-23', '1-0', '1-22', '1-23']);
    expect(result.map(({ temperature }) => temperature)).toEqual([18, 18, 18, 18, 18]);
  });

  test('현재 시각이 바뀌어도 남아 있는 예보의 식별자는 바뀌지 않는다', () => {
    // Given
    const forecasts = [21, 22, 23, 0].map(createForecast);
    const before = toUpcomingHourlyForecasts(forecasts, 21);

    // When
    const after = toUpcomingHourlyForecasts(forecasts, 22);

    // Then
    expect(after.map(({ id }) => id)).toEqual(before.slice(1).map(({ id }) => id));
    expect(forecasts.map(({ hour }) => hour)).toEqual([21, 22, 23, 0]);
    expect(forecasts[0]).not.toHaveProperty('id');
  });

  test('예보가 없으면 빈 목록을 반환한다', () => {
    // Given
    const forecasts: ReturnType<typeof createForecast>[] = [];

    // When
    const result = toUpcomingHourlyForecasts(forecasts, 22);

    // Then
    expect(result).toEqual([]);
  });
});

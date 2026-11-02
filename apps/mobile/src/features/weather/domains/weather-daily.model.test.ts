import { createWeatherReport } from '../__tests__/weather-report.factories';
import { WeatherDailyPolicy } from './weather-daily.model';

describe('WeatherDailyPolicy.temperaturePosition', () => {
  it('예보 기간 최저~최고 사이에서 지금 기온의 위치를 0~1로 반환한다', () => {
    // Given 최저 8° 최고 14° When 11°의 위치를 구하면 Then 가운데다
    const { daily } = createWeatherReport();

    expect(WeatherDailyPolicy.temperaturePosition(daily, 11)).toBe(0.5);
  });

  it('범위를 벗어난 기온은 양 끝에 붙인다', () => {
    // Given 최저 8° 최고 14° When 20°의 위치를 구하면 Then 1이다
    const { daily } = createWeatherReport();

    expect(WeatherDailyPolicy.temperaturePosition(daily, 20)).toBe(1);
  });

  it('예보가 없으면 null을 반환한다', () => {
    // Given 빈 예보 When 위치를 구하면 Then null이다
    expect(WeatherDailyPolicy.temperaturePosition([], 11)).toBeNull();
  });
});

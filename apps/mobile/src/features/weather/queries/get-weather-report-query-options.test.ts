import { createMockHttpClient } from '@src/shared/__tests__';

import { createWeatherReport } from '../__tests__/weather-report.factories';
import { WeatherService } from '../apis/weather.service';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import {
  getWeatherReportQueryOptions,
  WeatherReportSelect,
} from './get-weather-report-query-options';

describe('getWeatherReportQueryOptions', () => {
  it('위치가 실제로 바뀐 리비전마다 다른 리포트 캐시를 쓰고, 모두 날씨 무효화 범위 안에 둔다', () => {
    // Given
    const service = new WeatherService(createMockHttpClient());

    // When
    const saved = getWeatherReportQueryOptions(service, { locationRevision: 0 });
    const moved = getWeatherReportQueryOptions(service, { locationRevision: 1 });

    // Then
    expect(saved.queryKey).toEqual(['weather', 'report', { locationRevision: 0 }]);
    expect(saved.queryKey).not.toEqual(moved.queryKey);
    expect(saved.queryKey.slice(0, 2)).toEqual(WEATHER_QUERY_KEYS.reports());
  });
});

describe('WeatherReportSelect', () => {
  it('각 블록은 자기 조각만 받아 다른 조각의 변경에 묶이지 않는다', () => {
    // Given
    const report = createWeatherReport();

    // When
    const hourly = WeatherReportSelect.hourly(report);
    const attribution = WeatherReportSelect.attribution(report);

    // Then
    expect(Object.keys(hourly).sort()).toEqual(['hourly', 'location']);
    expect(Object.keys(attribution).sort()).toEqual(['attribution', 'fetchedAt', 'location']);
    expect(hourly.hourly).toBe(report.hourly);
  });
});

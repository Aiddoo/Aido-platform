import { createMockHttpClient } from '@src/shared/__tests__';

import { WeatherService } from '../apis/weather.service';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { getWeatherReportQueryOptions } from './get-weather-report-query-options';

describe('getWeatherReportQueryOptions', () => {
  it('위치 리비전마다 다른 리포트 캐시를 쓰고, 모두 날씨 무효화 범위 안에 둔다', () => {
    // Given
    const service = new WeatherService(createMockHttpClient());

    // When
    const seoul = getWeatherReportQueryOptions(service, { locationRevision: '37.56,127.00' });
    const busan = getWeatherReportQueryOptions(service, { locationRevision: '35.18,129.08' });

    // Then
    expect(seoul.queryKey).toEqual(['weather', 'report', { locationRevision: '37.56,127.00' }]);
    expect(seoul.queryKey).not.toEqual(busan.queryKey);
    expect(seoul.queryKey.slice(0, 2)).toEqual(WEATHER_QUERY_KEYS.reports());
  });
});

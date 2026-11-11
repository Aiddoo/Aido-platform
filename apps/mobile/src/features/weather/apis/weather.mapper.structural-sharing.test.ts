import { createTestQueryClient } from '@src/testing/core';

import { createSeoulReportDto } from '../__tests__/weather-report.fixtures';
import type { WeatherReport } from '../domains/weather-report.model';
import { toWeatherReport } from './weather.mapper';

describe('날씨 리포트 재조회의 구조 공유', () => {
  it('서버 값이 같으면 재조회해도 시간별 예보 항목의 참조가 그대로라 카드가 다시 그려지지 않는다', async () => {
    // Given
    const client = createTestQueryClient();
    const queryKey = ['weather', 'report'];
    const fetchReport = async () => {
      await client.query({
        queryKey,
        queryFn: () => toWeatherReport(createSeoulReportDto()),
        staleTime: 0,
      });
      return client.getQueryData<WeatherReport>(queryKey);
    };
    const first = await fetchReport();

    // When
    const second = await fetchReport();

    // Then
    const keptCount =
      second?.hourly.filter((hour, index) => hour === first?.hourly[index]).length ?? 0;
    expect(keptCount).toBe(first?.hourly.length);
    expect(keptCount).toBeGreaterThan(0);
  });
});

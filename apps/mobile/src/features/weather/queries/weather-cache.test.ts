import { createTestQueryClient } from '@src/testing/core';
import type { QueryClient } from '@tanstack/react-query';

import { createWeatherReport } from '../__tests__/weather-report.fixtures';
import { removeOutdatedWeatherReports } from './weather-cache';
import { WEATHER_QUERY_KEYS } from './weather-query-keys';

describe('removeOutdatedWeatherReports', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('지금 위치보다 이전 리비전의 리포트만 지우고 지금 리포트와 위치는 남긴다', () => {
    // Given
    const outdated = WEATHER_QUERY_KEYS.report({ locationRevision: 1 });
    const current = WEATHER_QUERY_KEYS.report({ locationRevision: 2 });
    const currentReport = createWeatherReport();
    queryClient.setQueryData(outdated, createWeatherReport());
    queryClient.setQueryData(current, currentReport);
    queryClient.setQueryData(WEATHER_QUERY_KEYS.location(), { status: 'denied' });

    // When
    removeOutdatedWeatherReports(queryClient, { locationRevision: 2 });

    // Then
    expect(queryClient.getQueryData(outdated)).toBeUndefined();
    expect(queryClient.getQueryData(current)).toEqual(currentReport);
    expect(queryClient.getQueryData(WEATHER_QUERY_KEYS.location())).toEqual({ status: 'denied' });
  });
});

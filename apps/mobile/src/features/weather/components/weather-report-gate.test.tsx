import { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import { QueryErrorBoundary } from '@src/shared/ui';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createLocationGatewayStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { useSuspenseQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createSeoulReportDto } from '../__tests__/weather-report.fixtures';
import { useGetWeatherReportQueryOptions } from '../queries/weather.queries';
import { WeatherReportGate } from './weather-report-gate';

function ReportBlock() {
  const { data } = useSuspenseQuery(useGetWeatherReportQueryOptions());
  return <Text>{data.location.timezone}</Text>;
}

async function renderGate(response: Result<unknown, ApiError>) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(response);
  const errorReporter = createErrorReporterStub();

  await renderScreen(
    <QueryErrorBoundary fallback={() => <Text>리포트 오류</Text>}>
      <WeatherReportGate fallback={() => <Text>위치 안내</Text>}>
        <WeatherReportGate.Suspense fallback={<Text>불러오는 중</Text>}>
          <ReportBlock />
        </WeatherReportGate.Suspense>
      </WeatherReportGate>
    </QueryErrorBoundary>,
    {
      di: createTestDi({
        ports: { httpClient, deviceLocation: createLocationGatewayStub(), errorReporter },
      }),
    },
  );
  return { errorReporter };
}

describe('WeatherReportGate', () => {
  it('서버에 위치가 없으면(WEATHER_1902) 경계로 던지지 않고 위치 안내를 그린다', async () => {
    // Given
    const notRegistered = new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404);

    // When
    const { errorReporter } = await renderGate({ ok: false, error: notRegistered });

    // Then
    expect(await screen.findByText('위치 안내')).toBeOnTheScreen();
    expect(screen.queryByText('리포트 오류')).not.toBeOnTheScreen();
    // 경계가 잡았다면 expected-state breadcrumb가 남는다
    expect(errorReporter.addBreadcrumb).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'query_boundary_expected_state' }),
    );
  });

  it('리포트를 받으면 블록을 그린다', async () => {
    // Given
    const report = createSeoulReportDto();

    // When
    await renderGate({ ok: true, value: report });

    // Then
    expect(await screen.findByText(report.location.timezone)).toBeOnTheScreen();
  });

  it('위치 미등록이 아닌 실패는 그대로 리포트 경계가 맡는다', async () => {
    // Given
    const unavailable = new ApiError('WEATHER_1901', '날씨 정보를 가져올 수 없어요', 503);

    // When
    await renderGate({ ok: false, error: unavailable });

    // Then
    expect(await screen.findByText('리포트 오류')).toBeOnTheScreen();
    expect(screen.queryByText('위치 안내')).not.toBeOnTheScreen();
  });
});

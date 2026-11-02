import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import type { Logger } from '@src/core/ports/logger';
import { createPreferenceDto } from '@src/features/preference/__tests__/preference.factories';
import { toPreference } from '@src/features/preference/apis/preference.mapper';
import { PreferenceService } from '@src/features/preference/apis/preference.service';
import { PREFERENCE_QUERY_KEYS } from '@src/features/preference/constants/preference-query-keys';
import { TodoService } from '@src/features/todo/apis/todo.service';
import { TODO_QUERY_KEYS } from '@src/features/todo/constants/todo-query-keys';
import { createMockHttpClient } from '@src/shared/__tests__';
import { createTestQueryClient, renderUi } from '@src/shared/__tests__/render-ui';
import { ApiError } from '@src/shared/errors/api-error';
import { QueryErrorBoundary } from '@src/shared/ui';
import { screen, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';

import { WeatherService } from '../apis/weather.service';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { WeatherBriefing } from './weather-briefing';

const TODAY = '2026-11-02';

jest.mock('@src/shared/hooks/use-today', () => ({
  useTodayKey: () => '2026-11-02',
}));

describe('WeatherBriefing', () => {
  it('리포트 요청이 실패해도 브리핑 경계는 오류를 보고·표시하지 않고 리포트 경계에 맡긴다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue({
      ok: false,
      error: new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404),
    });
    const errorReporter: jest.Mocked<ErrorReporter> = {
      captureException: jest.fn(),
      captureMessage: jest.fn(),
      addBreadcrumb: jest.fn(),
      setUserId: jest.fn(),
    };
    const logger: jest.Mocked<Logger> = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const gateway: jest.Mocked<LocationGateway> = {
      getPermission: jest.fn(),
      requestPermission: jest.fn(),
      getCoordinates: jest.fn(),
      getPlace: jest.fn(),
    };
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(WEATHER_QUERY_KEYS.location(), { status: 'unavailable', revision: 0 });
    queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: TODAY }), {
      todos: [],
      hasNext: false,
      nextCursor: null,
    });
    queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), toPreference(createPreferenceDto()));

    // When
    await renderUi(
      <QueryErrorBoundary fallback={WeatherBriefing.Error}>
        <Suspense fallback={null}>
          <WeatherBriefing />
        </Suspense>
      </QueryErrorBoundary>,
      {
        queryClient,
        di: {
          weatherService: new WeatherService(httpClient),
          locationGateway: gateway,
          logger,
          errorReporter,
          todoService: new TodoService(httpClient),
          preferenceService: new PreferenceService(httpClient),
        },
      },
    );

    // Then
    await waitFor(() =>
      expect(httpClient.get).toHaveBeenCalledWith('v2/weather', expect.anything()),
    );
    expect(errorReporter.captureException).not.toHaveBeenCalled();
    expect(errorReporter.addBreadcrumb).not.toHaveBeenCalled();
    expect(screen.queryByText('오늘 할 일을 불러오지 못했어요')).toBeNull();
    queryClient.clear();
  });
});

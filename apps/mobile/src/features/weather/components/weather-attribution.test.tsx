import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import type { Logger } from '@src/core/ports/logger';
import { createMockHttpClient } from '@src/shared/__tests__';
import { createTestQueryClient, renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { Suspense } from 'react';

import { createAttributionDto, createWeatherReport } from '../__tests__/weather-report.factories';
import { WeatherService } from '../apis/weather.service';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { WeatherAttribution } from './weather-attribution';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}));

const LEGAL_PAGE_URL = 'https://developer.apple.com/weatherkit/data-source-attribution/';

async function renderAttribution(report: ReturnType<typeof createWeatherReport>) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(WEATHER_QUERY_KEYS.location(), {
    status: 'located',
    registered: { latitude: 37.56, longitude: 126.99, timezone: 'Asia/Seoul' },
    placeName: null,
    revision: 0,
  });
  queryClient.setQueryData(WEATHER_QUERY_KEYS.report({ locationRevision: 0 }), report);
  const logger: jest.Mocked<Logger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const errorReporter: jest.Mocked<ErrorReporter> = {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUserId: jest.fn(),
  };
  const gateway: jest.Mocked<LocationGateway> = {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    getCoordinates: jest.fn(),
    getPlace: jest.fn(),
  };
  const result = await renderUi(
    <Suspense fallback={null}>
      <WeatherAttribution background="dark" />
    </Suspense>,
    {
      queryClient,
      di: {
        weatherService: new WeatherService(createMockHttpClient()),
        locationGateway: gateway,
        logger,
        errorReporter,
      },
    },
  );
  return { ...result, queryClient };
}

describe('WeatherAttribution', () => {
  it('Apple 날씨 로고를 표기하고 출처 링크를 누르면 출처 고지 페이지를 연다', async () => {
    // Given
    const { queryClient } = await renderAttribution(createWeatherReport());

    // When
    await fireEvent.press(screen.getByRole('link'));

    // Then
    expect(screen.getByTestId('weather-attribution-logo')).toBeTruthy();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(LEGAL_PAGE_URL, expect.anything());
    queryClient.clear();
  });

  it('로고를 받지 못하면 서비스 이름을 글자로 표기해 출처 표기를 빼지 않는다', async () => {
    // Given
    const report = createWeatherReport({ attribution: createAttributionDto({ logo: null }) });

    // When
    const { queryClient } = await renderAttribution(report);

    // Then
    expect(screen.queryByTestId('weather-attribution-logo')).toBeNull();
    expect(screen.getByText('Apple Weather')).toBeTruthy();
    queryClient.clear();
  });
});

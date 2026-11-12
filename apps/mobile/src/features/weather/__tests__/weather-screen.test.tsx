import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createTodoListResponseDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { type ApiError, ok, type Result } from '@src/shared/errors';
import {
  createHttpClientStub,
  createLocationGatewayStub,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';

import WeatherScreen from '../../../../app/(app)/weather/index';

jest.unmock('expo-router');

describe('WeatherScreen', () => {
  it('리포트를 받는 동안 10일 예보의 할 일 점 조회를 함께 시작한다', async () => {
    // Given
    // 위치를 확인하는 동안에도 화면은 서버 저장 위치로 리포트를 받는다
    const deviceLocation = createLocationGatewayStub();
    deviceLocation.getPermission.mockReturnValue(new Promise(() => undefined));
    const report = Promise.withResolvers<Result<unknown, ApiError>>();
    const completions = Promise.withResolvers<Result<unknown, ApiError>>();
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(
      respondByPath({
        'v2/weather': () => report.promise,
        'v1/daily-completions': () => completions.promise,
        'v1/todos': ok(createTodoListResponseDto({ items: [] })),
        'v1/auth/preference': ok(createPreferenceDto()),
      }),
    );

    // When
    await renderAppRoute(
      { _layout: () => <Stack />, 'weather/index': WeatherScreen },
      {
        url: '/weather',
        di: createTestDi({ ports: { httpClient, deviceLocation } }),
        withLocalDate: true,
      },
    );

    // Then
    await waitFor(() =>
      expect(httpClient.get).toHaveBeenCalledWith('v1/daily-completions', expect.anything()),
    );
    expect(httpClient.get).toHaveBeenCalledWith('v2/weather', expect.anything());
  });
});

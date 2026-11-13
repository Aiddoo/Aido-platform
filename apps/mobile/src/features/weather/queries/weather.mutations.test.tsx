import { ServerError } from '@src/shared/errors/infra-error';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { noop } from 'es-toolkit';

import { WEATHER_QUERY_KEYS } from './weather-query-keys';
import { useUpdateWeatherLocationMutationOptions } from './weather.mutations';

describe('useUpdateWeatherLocationMutationOptions', () => {
  it('위치 다시 등록이 실패해도 서버 위치가 바뀌었을 수 있어 받아 둔 리포트를 다시 받게 표시한다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.put.mockRejectedValue(new ServerError(500));
    const { result, queryClient } = await renderScreenHook(
      () => useMutation(useUpdateWeatherLocationMutationOptions()),
      { di: createTestDi({ ports: { httpClient } }) },
    );
    queryClient.setQueryData(WEATHER_QUERY_KEYS.reports(), null);

    // When
    await act(() => result.current.mutateAsync({ latitude: 37.5, longitude: 127 }).catch(noop));

    // Then
    expect(queryClient.getQueryState(WEATHER_QUERY_KEYS.reports())?.isInvalidated).toBe(true);
  });
});

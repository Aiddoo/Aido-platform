import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import { i18n } from '@src/shared/i18n';
import {
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation, useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import {
  createPreference,
  createPreferenceApiError,
  createPreferenceDto,
} from '../__tests__/preference.fixtures';
import { type Preference } from '../domains/preference.model';
import { PREFERENCE_QUERY_KEYS } from './preference-query-keys';
import { useUpdatePreferenceMutationOptions } from './preference.mutations';
import { useGetPreferenceQueryOptions } from './preference.queries';

async function renderUpdate(httpClient = createHttpClientStub()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    createPreference({ pushEnabled: true, nightPushEnabled: false }),
  );
  const { result } = await renderScreenHook(
    () => useMutation(useUpdatePreferenceMutationOptions()),
    {
      di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub(), queryClient } }),
    },
  );
  const cached = () => queryClient.getQueryData<Preference>(PREFERENCE_QUERY_KEYS.current());

  return {
    cached,
    update: (change: Parameters<typeof result.current.mutateAsync>[0]) =>
      result.current.mutateAsync(change),
  };
}

describe('설정 토글 저장', () => {
  it.each([
    ['nightPushEnabled', false],
    ['aiPushEnabled', true],
  ] as const)(
    '연결이 없으면 바로 실패해 바꾼 토글(%s)을 되돌리고 알린다',
    async (setting, saved) => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.patch.mockRejectedValue(new NetworkError());
      const { cached, update } = await renderUpdate(httpClient);

      // When
      const result = update({ [setting]: !saved });

      // Then
      await expect(result).rejects.toBeInstanceOf(NetworkError);
      expect(cached()?.[setting]).toBe(saved);
      expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    },
  );

  it('프리미엄 전용 시각을 서버가 거절하면 카탈로그 문구를 전역 피드백으로 알리고 값을 되돌린다', async () => {
    // Given
    const catalogMessage = i18n.t('errors:PREFERENCE_1701');
    const httpClient = createHttpClientStub();
    httpClient.patch.mockResolvedValue(
      fail(
        createPreferenceApiError({ code: 'PREFERENCE_1701', message: catalogMessage, status: 403 }),
      ),
    );
    const { cached, update } = await renderUpdate(httpClient);

    // When
    const result = update({ morningReminderHour: 6 });

    // Then
    await expect(result).rejects.toThrow(catalogMessage);
    expect(cached()?.morningReminderHour).toBe(8);
    expect(await screen.findAllByText('리마인드 시간 변경은 프리미엄 기능이에요')).not.toHaveLength(
      0,
    );
  });
});

describe('설정 토글을 연달아 저장', () => {
  it('앞 저장의 응답이 먼저 와도 뒤에 바꾼 토글을 되돌리지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const first = createPendingResponse(
      ok(createPreferenceDto({ pushEnabled: false, nightPushEnabled: false })),
    );
    const second = createPendingResponse(
      ok(createPreferenceDto({ pushEnabled: false, nightPushEnabled: true })),
    );
    httpClient.patch
      .mockImplementationOnce(() => first.response)
      .mockImplementationOnce(() => second.response);
    const { cached, update } = await renderUpdate(httpClient);
    const firstResult = update({ pushEnabled: false });
    const secondResult = update({ nightPushEnabled: true });
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(2));

    // When
    await act(async () => {
      first.settle();
      await firstResult;
    });

    // Then
    expect(cached()).toMatchObject({ pushEnabled: false, nightPushEnabled: true });
    await act(async () => {
      second.settle();
      await secondResult;
    });
    expect(cached()).toMatchObject({ pushEnabled: false, nightPushEnabled: true });
  });

  it('서버가 처리한 순서와 응답이 어긋나게 와도 마지막 응답 대신 서버 값을 다시 받아 맞춘다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    // 서버는 앞 저장을 먼저 처리해 앞 응답에는 뒤 토글이 없다. 응답은 뒤 저장이 먼저 온다
    const serverFinal = createPreferenceDto({ pushEnabled: false, nightPushEnabled: true });
    const first = createPendingResponse(
      ok(createPreferenceDto({ pushEnabled: false, nightPushEnabled: false })),
    );
    const second = createPendingResponse(ok(serverFinal));
    httpClient.patch
      .mockImplementationOnce(() => first.response)
      .mockImplementationOnce(() => second.response);
    httpClient.get.mockResolvedValue(
      ok(createPreferenceDto({ pushEnabled: true, nightPushEnabled: false })),
    );
    const queryClient = createTestQueryClient();
    const { result } = await renderScreenHook(
      () => ({
        update: useMutation(useUpdatePreferenceMutationOptions()),
        preference: useQuery(useGetPreferenceQueryOptions()),
      }),
      { di: createTestDi({ ports: { httpClient, queryClient } }) },
    );
    await waitFor(() => expect(result.current.preference.data?.pushEnabled).toBe(true));
    const firstResult = result.current.update.mutateAsync({ pushEnabled: false });
    const secondResult = result.current.update.mutateAsync({ nightPushEnabled: true });
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(2));
    httpClient.get.mockResolvedValue(ok(serverFinal));

    // When
    await act(async () => {
      second.settle();
      await secondResult;
      first.settle();
      await firstResult;
    });

    // Then
    expect(queryClient.getQueryData(PREFERENCE_QUERY_KEYS.current())).toMatchObject({
      pushEnabled: false,
      nightPushEnabled: true,
    });
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(2));
    expect(result.current.preference.data).toMatchObject({
      pushEnabled: false,
      nightPushEnabled: true,
    });
  });

  it('앞 저장이 실패하면 그 토글만 되돌리고 뒤에 바꾼 토글은 지킨다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const first = createPendingResponse(fail(createPreferenceApiError()));
    const second = createPendingResponse(
      ok(createPreferenceDto({ pushEnabled: true, nightPushEnabled: true })),
    );
    httpClient.patch
      .mockImplementationOnce(() => first.response)
      .mockImplementationOnce(() => second.response);
    const { cached, update } = await renderUpdate(httpClient);
    const firstResult = update({ pushEnabled: false });
    const secondResult = update({ nightPushEnabled: true });
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(2));

    // When
    await act(async () => {
      first.settle();
      await firstResult?.catch(() => undefined);
    });

    // Then
    expect(cached()).toMatchObject({ pushEnabled: true, nightPushEnabled: true });
    await act(async () => {
      second.settle();
      await secondResult;
    });
  });
});

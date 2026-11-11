import { err, ok } from '@src/core/errors/result';
import {
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors/infra-error';
import { useMutation } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import {
  createPreference,
  createPreferenceApiError,
  createPreferenceDto,
} from '../__tests__/preference.fixtures';
import { type Preference } from '../domains/preference.model';
import { PREFERENCE_QUERY_KEYS } from './preference-query-keys';
import { useUpdatePreferenceMutationOptions } from './preference.mutations';

async function renderUpdate(httpClient = createHttpClientStub()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    createPreference({ pushEnabled: true, nightPushEnabled: false }),
  );
  let mutateAsync: ReturnType<typeof useUpdate> | undefined;
  function useUpdate() {
    return useMutation(useUpdatePreferenceMutationOptions()).mutateAsync;
  }
  function Capture() {
    mutateAsync = useUpdate();
    return null;
  }
  await renderUi(<Capture />, {
    queryClient,
    di: { httpClient, haptics: createHapticsGatewayStub() },
  });
  const cached = () => queryClient.getQueryData<Preference>(PREFERENCE_QUERY_KEYS.current());

  return {
    cached,
    update: (change: Parameters<NonNullable<typeof mutateAsync>>[0]) => mutateAsync?.(change),
  };
}

describe('설정 토글 저장', () => {
  it('연결이 없으면 바로 실패해 바꾼 토글을 되돌리고 알린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockRejectedValue(new NetworkError());
    const { cached, update } = await renderUpdate(httpClient);

    // When
    const result = update({ nightPushEnabled: true });

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
    expect(cached()?.nightPushEnabled).toBe(false);
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
  });

  it('프리미엄 전용 시각을 서버가 거절하면 우리 문구로 알리고 값을 되돌린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockResolvedValue(
      err(createPreferenceApiError({ code: 'PREFERENCE_1701', message: '서버 문구', status: 403 })),
    );
    const { cached, update } = await renderUpdate(httpClient);

    // When
    const result = update({ morningReminderHour: 6 });

    // Then
    await expect(result).rejects.toThrow('서버 문구');
    expect(cached()?.morningReminderHour).toBe(8);
    expect(await screen.findAllByText('리마인드 시간 변경은 프리미엄 기능이에요')).not.toHaveLength(
      0,
    );
    expect(screen.queryByText('서버 문구')).toBeNull();
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

  it('앞 저장이 실패하면 그 토글만 되돌리고 뒤에 바꾼 토글은 지킨다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const first = createPendingResponse(err(createPreferenceApiError()));
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

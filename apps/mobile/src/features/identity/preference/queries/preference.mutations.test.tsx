import { err, ok } from '@src/core/errors/result';
import { createHapticsStub, createHttpClientStub } from '@src/shared/__tests__';
import { createTestDi } from '@src/shared/__tests__/create-test-di';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { NetworkError } from '@src/shared/errors/infra-error';
import { useMutation } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';

import {
  createPreference,
  createPreferenceApiError,
  createPreferenceDto,
} from '../__tests__/preference.fixtures';
import { PREFERENCE_QUERY_KEYS } from '../constants/preference-query-keys';
import type { Preference } from '../schemas/preference.schema';
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
    di: createTestDi({ httpClient, haptics: createHapticsStub() }),
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

  it('저장하면 서버가 돌려준 값으로 캐시를 바꾼다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockResolvedValue(
      ok(createPreferenceDto({ nightPushEnabled: true, timezone: 'America/New_York' })),
    );
    const { cached, update } = await renderUpdate(httpClient);

    // When
    await update({ nightPushEnabled: true });

    // Then
    expect(cached()).toEqual(createPreference({ nightPushEnabled: true }));
    expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/preference', { nightPushEnabled: true });
  });
});

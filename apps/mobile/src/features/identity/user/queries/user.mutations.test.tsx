import { ok } from '@src/core/errors/result';
import {
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';

import { createUpdateProfileDto, createUser } from '../__tests__/user.fixtures';
import { type User } from '../domains/user.model';
import type { ProfileChange } from '../schemas/update-profile-request.schema';
import { USER_QUERY_KEYS } from './user-query-keys';
import { useUpdateProfileMutationOptions } from './user.mutations';

const NEW_IMAGE = 'https://example.com/new.jpg';

async function renderUpdateProfile(httpClient = createHttpClientStub()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '이전', profileImage: null }));
  const { result } = await renderScreenHook(() => useMutation(useUpdateProfileMutationOptions()), {
    di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub(), queryClient } }),
  });

  return {
    cached: () => queryClient.getQueryData<User>(USER_QUERY_KEYS.me()),
    update: (change: ProfileChange) => result.current.mutateAsync(change),
  };
}

describe('프로필을 연달아 저장', () => {
  it('사진 저장 중에 바꾼 이름의 응답이 먼저 와도 새 사진을 되돌리지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const image = createPendingResponse(
      ok(createUpdateProfileDto({ name: '이전', profileImage: NEW_IMAGE })),
    );
    const name = createPendingResponse(
      ok(createUpdateProfileDto({ name: '새이름', profileImage: null })),
    );
    httpClient.patch
      .mockImplementationOnce(() => image.response)
      .mockImplementationOnce(() => name.response);
    const { cached, update } = await renderUpdateProfile(httpClient);
    const imageResult = update({ profileImage: NEW_IMAGE });
    const nameResult = update({ name: '새이름' });
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(2));

    // When
    await act(async () => {
      name.settle();
      await nameResult;
    });

    // Then
    expect(cached()).toMatchObject({ name: '새이름', profileImage: NEW_IMAGE });
    await act(async () => {
      image.settle();
      await imageResult;
    });
    expect(cached()).toMatchObject({ name: '새이름', profileImage: NEW_IMAGE });
  });
});

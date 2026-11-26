import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
  deliverQueryNotifications,
  createApiError,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useNavigation } from 'expo-router';

import EditNameRoute from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/edit-name';
import { USER_QUERY_KEYS } from '../queries/user-query-keys';
import { createUser } from './user.fixtures';
import { createUpdateProfileDto } from './user.fixtures';

async function renderEditName(
  httpClient: ReturnType<typeof createHttpClientStub>,
  { name = '테스트' }: { name?: string } = {},
) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name }));
  const analytics = createAnalyticsStub();
  const haptics = createHapticsGatewayStub();
  await renderScreen(<EditNameRoute />, {
    di: createTestDi({ ports: { httpClient, analytics, haptics, queryClient } }),
  });

  return { queryClient, analytics, haptics };
}

async function typeName(name: string) {
  await fireEvent.changeText(screen.getByTestId('edit-name-input'), name);
}

describe('EditNameRoute', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    jest.mocked(router.back).mockClear();
    httpClient = createHttpClientStub();
  });

  it('연결이 끊겨 저장에 실패해도 오류 화면으로 바뀌지 않고 입력값을 지킨다', async () => {
    // Given
    httpClient.patch.mockRejectedValue(new NetworkError());
    await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('edit-name-submit'));

    // Then
    // 오류 화면으로 바뀌지 않고 토스트로 알리며 화면과 입력값은 그대로다
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(screen.getByTestId('edit-name-input').props.value).toBe('새이름');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('서버가 거절하면 한 번 알리고 입력값을 둔 채 화면에 머물며 이름은 원래대로 둔다', async () => {
    // Given
    httpClient.patch.mockResolvedValue(
      fail(createApiError('SYS_0001', { message: '이름을 바꿀 수 없어요', status: 400 })),
    );
    const { queryClient, haptics, analytics } = await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('edit-name-submit'));

    // Then
    expect(await screen.findAllByText('이름을 바꿀 수 없어요')).not.toHaveLength(0);
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(screen.getByTestId('edit-name-input')).toHaveDisplayValue('새이름');
    expect(router.back).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(USER_QUERY_KEYS.me())?.name).toBe('테스트');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('profile_edited', { field: 'name' });
  });

  it('공백만 쓴 이름은 빈 이름으로 보고 저장 버튼을 켜지 않는다', async () => {
    // Given
    await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await typeName('   ');

    // Then
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeDisabled());
  });

  it('20자를 넘는 이름은 칸에 알리고 완료 키를 눌러도 보내지 않는다', async () => {
    // Given
    await renderEditName(httpClient);

    // When
    await typeName('가'.repeat(21));
    await fireEvent(screen.getByTestId('edit-name-input'), 'submitEditing');

    // Then
    expect(await screen.findByText('이름은 20자 이내로 입력해주세요')).toBeOnTheScreen();
    expect(screen.getByTestId('edit-name-submit')).toBeDisabled();
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('지금 이름으로 되돌려 쓰면 바뀐 것이 없어 저장 버튼을 켜지 않는다', async () => {
    // Given
    await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await typeName('테스트');

    // Then
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeDisabled());
    await fireEvent(screen.getByTestId('edit-name-input'), 'submitEditing');
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('저장하면 한 번만 보내고 뒤로 간다', async () => {
    // Given
    httpClient.patch.mockResolvedValue(ok(createUpdateProfileDto({ name: '새이름' })));
    await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('edit-name-submit'));
    await fireEvent.press(screen.getByTestId('edit-name-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/profile', { name: '새이름' });
  });

  it('돌아갈 화면이 없으면 저장한 뒤 프로필 설정으로 간다', async () => {
    // Given
    jest.mocked(router.canGoBack).mockReturnValue(false);
    httpClient.patch.mockResolvedValue(ok(createUpdateProfileDto({ name: '새이름' })));
    await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('edit-name-submit'));

    // Then
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/settings/profile'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('저장하면 내 정보의 이름을 바꾸고 이름 수정을 한 번 남긴다', async () => {
    // Given
    httpClient.patch.mockResolvedValue(ok(createUpdateProfileDto({ name: '새이름' })));
    const { queryClient, analytics } = await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent(screen.getByTestId('edit-name-input'), 'submitEditing');

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(USER_QUERY_KEYS.me())?.name).toBe('새이름');
    expect(
      analytics.trackEvent.mock.calls.filter(([eventName]) => eventName === 'profile_edited'),
    ).toEqual([['profile_edited', { field: 'name' }]]);
  });

  it('저장하는 동안 화면을 떠났으면 저장이 끝나도 또 뒤로 가지 않는다', async () => {
    // Given
    let isFocused = true;
    jest.mocked(useNavigation).mockImplementation(() => ({
      isFocused: () => isFocused,
      getParent: () => undefined,
      addListener: () => () => undefined,
    }));
    const pending = createPendingResponse(ok(createUpdateProfileDto({ name: '새이름' })));
    httpClient.patch.mockReturnValue(pending.response);
    const { queryClient } = await renderEditName(httpClient);
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('edit-name-submit'));

    // When
    isFocused = false;
    await act(async () => {
      pending.settle();
    });

    // Then
    await waitFor(() =>
      expect(queryClient.getQueryData(USER_QUERY_KEYS.me())?.name).toBe('새이름'),
    );
    await act(async () => {
      await deliverQueryNotifications();
    });
    expect(router.back).not.toHaveBeenCalled();
  });

  it('고치기 전에는 다시 받은 서버 이름을 따라간다', async () => {
    // Given
    const { queryClient } = await renderEditName(httpClient, { name: '처음 이름' });

    // When
    await act(async () => {
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '다른 기기 이름' }));
    });

    // Then
    await waitFor(() =>
      expect(screen.getByTestId('edit-name-input')).toHaveDisplayValue('다른 기기 이름'),
    );
  });

  it('고치는 중에 서버 이름이 다시 받아져도 적던 글자를 덮지 않는다', async () => {
    // Given
    const { queryClient } = await renderEditName(httpClient, { name: '처음 이름' });
    await typeName('새 이름');

    // When
    await act(async () => {
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '다른 기기 이름' }));
    });

    // Then
    expect(screen.getByTestId('edit-name-input')).toHaveDisplayValue('새 이름');
  });

  it('고치는 중에 서버 이름이 다시 받아져도 저장 버튼은 켜진 채 남는다', async () => {
    // Given
    const { queryClient } = await renderEditName(httpClient, { name: '처음 이름' });
    await typeName('새 이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await act(async () => {
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '다른 기기 이름' }));
      await deliverQueryNotifications();
    });

    // Then
    expect(screen.getByTestId('edit-name-submit')).toBeEnabled();
  });

  it('칸 오류는 서버 이름을 다시 받아도 남는다', async () => {
    // Given
    const { queryClient } = await renderEditName(httpClient, { name: '처음 이름' });
    await typeName('');
    // 화면 제목도 같은 문구라 제목과 칸 오류 두 곳이다
    expect(await screen.findAllByText('이름을 입력해주세요')).toHaveLength(2);

    // When
    await act(async () => {
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '다른 기기 이름' }));
      await deliverQueryNotifications();
    });

    // Then
    expect(screen.getAllByText('이름을 입력해주세요')).toHaveLength(2);
    expect(screen.getByTestId('edit-name-submit')).toBeDisabled();
  });

  it('이름을 쳐도 폼을 가진 화면은 다시 그려지지 않고 칸과 버튼만 바뀐다', async () => {
    // Given
    await renderEditName(httpClient);
    // 폼을 가진 화면만 떠났는지 보려고 navigation을 읽어, 그 호출 수가 화면이 그려진 횟수다
    const renderCountBeforeTyping = jest.mocked(useNavigation).mock.calls.length;

    // When
    await typeName('새');
    await typeName('새이');
    await typeName('새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // Then
    expect(jest.mocked(useNavigation).mock.calls).toHaveLength(renderCountBeforeTyping);
  });

  describe('저장 뒤 떠나는 동안', () => {
    setupFakeTimersPerTest();

    it('저장해 화면이 내려가는 동안 다시 눌러도 이름은 한 번만 보낸다', async () => {
      // Given
      httpClient.patch.mockResolvedValue(ok(createUpdateProfileDto({ name: '새이름' })));
      await renderEditName(httpClient);
      await typeName('새이름');
      await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());
      await fireEvent.press(screen.getByTestId('edit-name-submit'));
      // 연타 가드(600ms)가 지난 뒤다. 화면은 뒤로 가는 전환이 끝나야 내려가 버튼이 아직 보인다
      await act(() => jest.advanceTimersByTimeAsync(1_000));
      expect(router.back).toHaveBeenCalledTimes(1);

      // When
      await fireEvent.press(screen.getByTestId('edit-name-submit'));
      await act(() => jest.advanceTimersByTimeAsync(1_000));

      // Then
      expect(httpClient.patch).toHaveBeenCalledTimes(1);
    });
  });
});

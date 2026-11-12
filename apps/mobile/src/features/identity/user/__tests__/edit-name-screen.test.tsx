import { ok } from '@src/core/errors/result';
import '@src/shared/i18n/init';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import EditNameRoute from '../../../../../app/(app)/(tabs)/(mypage)/settings/edit-name';
import { USER_QUERY_KEYS } from '../queries/user-query-keys';
import { createUser } from './user.fixtures';
import { createUpdateProfileDto } from './user.fixtures';

async function renderEditName(httpClient: ReturnType<typeof createHttpClientStub>) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '테스트' }));
  await renderScreen(<EditNameRoute />, {
    di: createTestDi({ ports: { httpClient, haptics: createHapticsGatewayStub(), queryClient } }),
  });
}

describe('이름 수정 화면', () => {
  let httpClient: ReturnType<typeof createHttpClientStub>;

  beforeEach(() => {
    jest.mocked(router.back).mockClear();
    httpClient = createHttpClientStub();
  });

  it('연결이 끊겨 저장에 실패해도 오류 화면으로 바뀌지 않고 입력값을 지킨다', async () => {
    // Given
    httpClient.patch.mockRejectedValue(new NetworkError());
    await renderEditName(httpClient);
    await fireEvent.changeText(screen.getByTestId('edit-name-input'), '새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('edit-name-submit'));

    // Then
    // 오류 화면으로 바뀌지 않고 토스트로 알리며 화면과 입력값은 그대로다
    expect(await screen.findAllByText(new NetworkError().message)).not.toHaveLength(0);
    expect(screen.getByTestId('edit-name-input').props.value).toBe('새이름');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('공백만 쓴 이름은 빈 이름으로 보고 저장 버튼을 켜지 않는다', async () => {
    // Given
    await renderEditName(httpClient);
    await fireEvent.changeText(screen.getByTestId('edit-name-input'), '새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent.changeText(screen.getByTestId('edit-name-input'), '   ');

    // Then
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeDisabled());
  });

  it('저장하면 한 번만 보내고 뒤로 간다', async () => {
    // Given
    httpClient.patch.mockResolvedValue(ok(createUpdateProfileDto({ name: '새이름' })));
    await renderEditName(httpClient);
    await fireEvent.changeText(screen.getByTestId('edit-name-input'), '새이름');
    await waitFor(() => expect(screen.getByTestId('edit-name-submit')).toBeEnabled());

    // When
    await fireEvent.press(screen.getByTestId('edit-name-submit'));
    await fireEvent.press(screen.getByTestId('edit-name-submit'));

    // Then
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/profile', { name: '새이름' });
  });
});

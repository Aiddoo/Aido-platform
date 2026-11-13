import '@src/shared/i18n/init';
import { createTestDi, createTestQueryClient, deliverQueryNotifications } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createUser } from '../__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '../queries/user-query-keys';
import { EditNameForm } from './edit-name-form';

async function renderForm(name: string) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name }));
  await renderScreen(<EditNameForm title="이름" />, {
    di: createTestDi({ ports: { queryClient } }),
  });
  return { queryClient };
}

describe('EditNameForm', () => {
  it('고치기 전에는 다시 받은 서버 이름을 따라간다', async () => {
    // Given
    const { queryClient } = await renderForm('처음 이름');

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
    const { queryClient } = await renderForm('처음 이름');
    await fireEvent.changeText(screen.getByTestId('edit-name-input'), '새 이름');

    // When
    await act(async () => {
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '다른 기기 이름' }));
    });

    // Then
    expect(screen.getByTestId('edit-name-input')).toHaveDisplayValue('새 이름');
  });

  it('고치는 중에 서버 이름이 다시 받아져도 저장 버튼은 켜진 채 남는다', async () => {
    // Given
    const { queryClient } = await renderForm('처음 이름');
    await fireEvent.changeText(screen.getByTestId('edit-name-input'), '새 이름');
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
    const { queryClient } = await renderForm('처음 이름');
    await fireEvent.changeText(screen.getByTestId('edit-name-input'), '');
    expect(await screen.findByText('이름을 입력해주세요')).toBeTruthy();

    // When
    await act(async () => {
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ name: '다른 기기 이름' }));
      await deliverQueryNotifications();
    });

    // Then
    expect(screen.getByText('이름을 입력해주세요')).toBeTruthy();
    expect(screen.getByTestId('edit-name-submit')).toBeDisabled();
  });
});

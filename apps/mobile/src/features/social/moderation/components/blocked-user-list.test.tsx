import '@src/shared/i18n/init';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';

import { BlockedUserList } from './blocked-user-list';

describe('BlockedUserList', () => {
  it('차단 해제가 실패하면 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.delete.mockRejectedValue(new NetworkError());
    await renderScreen(<BlockedUserList.UnblockButton userId="user-2" displayName="홍길동" />, {
      di: createTestDi({ ports: { httpClient } }),
      withOverlay: true,
    });
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않는다
    const opening = fireEvent.press(screen.getByRole('button', { name: '차단 해제' }));
    await screen.findByText('홍길동님 차단을 해제할까요?');

    // When
    await fireEvent.press(screen.getByRole('button', { name: '해제하기' }));

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/blocks/user-2');
    expect(screen.getByText('홍길동님 차단을 해제할까요?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '해제하기' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });
});

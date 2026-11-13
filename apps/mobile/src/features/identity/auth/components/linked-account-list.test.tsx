import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createLinkedAccountsDto } from '../__tests__/auth.fixtures';
import { LinkedAccountList } from './linked-account-list';

describe('LinkedAccountList', () => {
  it('연결 해제가 실패하면 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createLinkedAccountsDto()));
    httpClient.delete.mockRejectedValue(new NetworkError());
    await renderScreen(
      <Suspense fallback={null}>
        <LinkedAccountList />
      </Suspense>,
      { di: createTestDi({ ports: { httpClient } }), withOverlay: true },
    );
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않는다
    const opening = fireEvent.press(await screen.findByRole('button', { name: '해제' }));
    await screen.findByText('계정 연결 해제');

    // When
    const confirm = screen.getAllByRole('button', { name: '해제' }).at(-1);
    if (confirm == null) {
      throw new Error('확인 버튼이 없습니다');
    }
    await fireEvent.press(confirm);

    // Then
    expect(httpClient.delete).toHaveBeenCalledWith('v1/auth/linked-accounts/GOOGLE');
    expect(screen.getByText('계정 연결 해제')).toBeOnTheScreen();
    expect(confirm).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });
});

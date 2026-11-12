import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

import { createFriendsListDto } from '../__tests__/friend.fixtures';
import { FriendList } from './friend-list';

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);

describe('FriendList', () => {
  it('친구 끊기가 실패하면 그 친구를 되돌리고 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ isEditing: 'true' });
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createFriendsListDto()));
    httpClient.delete.mockRejectedValue(new NetworkError());
    await renderScreen(
      <Suspense fallback={null}>
        <FriendList />
      </Suspense>,
      { di: createTestDi({ ports: { httpClient } }), withOverlay: true },
    );
    const [deleteButton] = await screen.findAllByRole('button', { name: '삭제' });
    if (deleteButton == null) {
      throw new Error('삭제 버튼이 없습니다');
    }
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않는다
    const opening = fireEvent.press(deleteButton);
    await screen.findByText('홍길동님을 친구에서 삭제할까요?');

    // When
    const confirm = screen.getAllByRole('button', { name: '삭제' }).at(-1);
    if (confirm == null) {
      throw new Error('확인 버튼이 없습니다');
    }
    await fireEvent.press(confirm);

    // Then
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('홍길동님을 친구에서 삭제할까요?')).toBeOnTheScreen();
    expect(confirm).toBeEnabled();
    expect(screen.getByText('홍길동')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });
});

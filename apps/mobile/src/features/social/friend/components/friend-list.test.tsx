import '@src/shared/i18n/init';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi, deliverQueryNotifications } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

import { createFriendsListDto } from '../__tests__/friend.fixtures';
import { FriendList } from './friend-list';

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);

describe('FriendList', () => {
  it('친구 끊기 요청 중 행이 빠졌다가 실패하면 그 친구를 되돌리고 확인 다이얼로그를 남긴다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ isEditing: 'true' });
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createFriendsListDto()));
    const removal = Promise.withResolvers<Result<unknown, ApiError>>();
    httpClient.delete.mockReturnValue(removal.promise);
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
    const confirm = screen.getAllByRole('button', { name: '삭제' }).at(-1);
    if (confirm == null) {
      throw new Error('확인 버튼이 없습니다');
    }

    // When
    // 확인 누름은 요청이 끝나야 풀린다. 그리기만 마치고 약속은 쥔다
    let confirmPress: Promise<void> = Promise.resolve();
    await act(async () => {
      confirmPress = fireEvent.press(confirm);
    });
    await act(deliverQueryNotifications);

    // Then
    // 기기처럼 응답보다 낙관적 갱신이 먼저 그려져 행이 빠져도 다이얼로그는 진행 중으로 남는다
    expect(screen.queryByText('홍길동')).toBeNull();
    expect(screen.getByText('홍길동님을 친구에서 삭제할까요?')).toBeOnTheScreen();

    // When
    await act(async () => {
      removal.reject(new NetworkError());
      await confirmPress;
    });
    await act(deliverQueryNotifications);

    // Then
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('홍길동')).toBeOnTheScreen();
    expect(screen.getByText('홍길동님을 친구에서 삭제할까요?')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: '삭제' }).at(-1)).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });
});

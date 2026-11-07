import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useFeedAction, useFeedFriendId } from './use-feed-params';

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const FRIEND_ID = 'cmfriend000000000000000001';

describe('useFeedFriendId', () => {
  it('URL의 친구를 읽는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ friendId: FRIEND_ID });

    // When
    const { result } = await renderHook(() => useFeedFriendId());

    // Then
    expect(result.current[0]).toBe(FRIEND_ID);
  });

  it('형식이 틀린 친구는 내 피드로 읽는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ friendId: 'not-a-user' });

    // When
    const { result } = await renderHook(() => useFeedFriendId());

    // Then
    expect(result.current[0]).toBeUndefined();
  });

  it('친구를 바꾸면 이전 할 일 선택·댓글·요청 상태를 지우고 날짜는 건드리지 않는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ date: '2026-10-23', todoId: '5' });
    const { result } = await renderHook(() => useFeedFriendId());

    // When
    result.current[1](FRIEND_ID);

    // Then
    expect(jest.mocked(router.setParams).mock.calls[0]?.[0]).toStrictEqual({
      friendId: FRIEND_ID,
      todoId: undefined,
      comment: undefined,
      sort: undefined,
      action: undefined,
    });
  });

  it('나를 고르면 friendId를 지운다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ friendId: FRIEND_ID });
    const { result } = await renderHook(() => useFeedFriendId());

    // When
    result.current[1](undefined);

    // Then
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ friendId: undefined }));
  });
});

describe('useFeedAction', () => {
  it.each([
    ['add-todo', 'add-todo'],
    ['delete-all', undefined],
    [undefined, undefined],
  ])('action=%s는 %s로 읽는다', async (action, expected) => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ action });

    // When
    const { result } = await renderHook(() => useFeedAction());

    // Then
    expect(result.current[0]).toBe(expected);
  });

  it('요청을 처리하면 action만 지운다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ action: 'add-todo', date: '2026-10-23' });
    const { result } = await renderHook(() => useFeedAction());

    // When
    result.current[1](undefined);

    // Then
    expect(jest.mocked(router.setParams).mock.calls[0]?.[0]).toStrictEqual({ action: undefined });
  });
});

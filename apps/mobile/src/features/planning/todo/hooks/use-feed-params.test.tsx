import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useFeedParams } from './use-feed-params';

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const FRIEND_ID = 'cmfriend000000000000000001';

describe('useFeedParams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('URL의 날짜·친구·요청을 읽는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({
      date: '2026-10-23',
      friendId: FRIEND_ID,
      action: 'add-todo',
    });

    // When
    const { result } = await renderHook(() => useFeedParams());

    // Then
    expect(result.current).toMatchObject({
      date: '2026-10-23',
      friendId: FRIEND_ID,
      action: 'add-todo',
    });
  });

  it('잘못된 값은 없는 것으로 읽는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ date: '내일', action: 'delete-all' });

    // When
    const { result } = await renderHook(() => useFeedParams());

    // Then
    expect(result.current.date).toBeUndefined();
    expect(result.current.action).toBeUndefined();
  });

  it('친구를 바꾸면 이전 할 일 선택·댓글·요청 상태를 지우고 날짜는 건드리지 않는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({});
    const { result } = await renderHook(() => useFeedParams());

    // When
    result.current.selectFriend(FRIEND_ID);

    // Then
    expect(router.setParams).toHaveBeenCalledWith({
      friendId: FRIEND_ID,
      todoId: undefined,
      comment: undefined,
      intent: undefined,
      returnTo: undefined,
      sort: undefined,
      action: undefined,
    });
  });

  it('나를 고르면 friendId를 지운다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ friendId: 'friend-1' });
    const { result } = await renderHook(() => useFeedParams());

    // When
    result.current.selectFriend(undefined);

    // Then
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ friendId: undefined }));
  });

  it('날짜를 바꾸면 날짜만 바꾼다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({});
    const { result } = await renderHook(() => useFeedParams());

    // When
    result.current.selectDate('today');

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ date: 'today' });
  });
});

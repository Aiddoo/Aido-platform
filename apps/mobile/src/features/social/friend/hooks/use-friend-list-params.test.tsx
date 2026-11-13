import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useFriendListIsEditing, useFriendListView } from './use-friend-list-params';

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);

describe('useFriendListView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('친구 탭이 아닌 탭으로 옮기면 편집 모드를 함께 끈다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ isEditing: 'true' });
    const { result } = await renderHook(() => useFriendListView());

    // When
    result.current[1]('receiver');

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ view: 'receiver', isEditing: undefined });
  });

  it('친구 탭으로 옮길 때는 편집 모드를 건드리지 않는다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({ view: 'sender' });
    const { result } = await renderHook(() => useFriendListView());

    // When
    result.current[1]('friends');

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ view: 'friends' });
  });
});

describe('useFriendListIsEditing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['true', true],
    ['false', false],
    ['invalid', false],
    [undefined, false],
  ])('딥링크 isEditing=%s는 편집 모드 %s로 읽는다', async (isEditing, expected) => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue(isEditing == null ? {} : { isEditing });

    // When
    const { result } = await renderHook(() => useFriendListIsEditing());

    // Then
    expect(result.current[0]).toBe(expected);
  });

  it('편집 모드를 켜면 param을 true로, 끄면 제거한다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({});
    const { result } = await renderHook(() => useFriendListIsEditing());

    // When
    result.current[1](true);
    result.current[1](false);

    // Then
    expect(router.setParams).toHaveBeenNthCalledWith(1, { isEditing: 'true' });
    expect(router.setParams).toHaveBeenNthCalledWith(2, { isEditing: undefined });
  });
});

import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useFriendListView } from './use-friend-list-view';

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

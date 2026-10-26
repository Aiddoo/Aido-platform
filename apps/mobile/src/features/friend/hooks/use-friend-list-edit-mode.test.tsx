import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useFriendListEditMode } from './use-friend-list-edit-mode';

jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);

describe('useFriendListEditMode', () => {
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
    const { result } = await renderHook(() => useFriendListEditMode());

    // Then
    expect(result.current[0]).toBe(expected);
  });

  it('편집 모드를 켜면 param을 true로, 끄면 제거한다', async () => {
    // Given
    mockedUseLocalSearchParams.mockReturnValue({});
    const { result } = await renderHook(() => useFriendListEditMode());

    // When
    result.current[1](true);
    result.current[1](false);

    // Then
    expect(router.setParams).toHaveBeenNthCalledWith(1, { isEditing: 'true' });
    expect(router.setParams).toHaveBeenNthCalledWith(2, { isEditing: undefined });
  });
});

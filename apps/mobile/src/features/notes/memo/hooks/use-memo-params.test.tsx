import { stubWindowDimensions } from '@src/testing/core';
import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useSelectedMemoId } from './use-memo-params';

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);
function givenWindow(width: number, params: Record<string, string> = {}) {
  stubWindowDimensions(width);
  mockedUseLocalSearchParams.mockReturnValue(params);
}

describe('useSelectedMemoId', () => {
  it('URL의 memoId를 숫자로 읽는다', async () => {
    // Given
    givenWindow(700, { memoId: '12' });

    // When
    const { result } = await renderHook(() => useSelectedMemoId());

    // Then
    expect(result.current[0]).toBe(12);
  });

  it('잘못된 memoId는 선택 없음으로 본다', async () => {
    // Given
    givenWindow(700, { memoId: 'abc' });

    // When
    const { result } = await renderHook(() => useSelectedMemoId());

    // Then
    expect(result.current[0]).toBeUndefined();
  });

  it('compact에서는 상세 라우트로 push한다', async () => {
    // Given
    givenWindow(390);
    const { result } = await renderHook(() => useSelectedMemoId());

    // When
    result.current[1](5);

    // Then
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/memo/[memoId]',
      params: { memoId: 5 },
    });
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('compact에서 선택 해제는 아무것도 하지 않는다', async () => {
    // Given
    givenWindow(390);
    const { result } = await renderHook(() => useSelectedMemoId());

    // When
    result.current[1](undefined);

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('medium 이상에서는 메모 탭 URL param을 바꾼다', async () => {
    // Given
    givenWindow(700);
    const { result } = await renderHook(() => useSelectedMemoId());

    // When
    result.current[1](5);

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ memoId: '5' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('medium 이상에서 undefined를 고르면 선택을 해제한다', async () => {
    // Given
    givenWindow(900, { memoId: '5' });
    const { result } = await renderHook(() => useSelectedMemoId());

    // When
    result.current[1](undefined);

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ memoId: undefined });
  });
});

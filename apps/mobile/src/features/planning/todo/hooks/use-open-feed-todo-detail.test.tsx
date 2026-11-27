import { stubWindowDimensions } from '@src/testing/core';
import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useOpenFeedTodoDetail } from './use-open-feed-todo-detail';

function givenWindow(width: number, params: Record<string, string> = {}) {
  stubWindowDimensions(width);
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
}

describe('useOpenFeedTodoDetail', () => {
  it('접힌 화면에서는 상세 화면으로 가고 피드 URL은 건드리지 않는다', async () => {
    // Given
    givenWindow(390);
    const { result } = await renderHook(() => useOpenFeedTodoDetail());

    // When
    result.current(7);

    // Then
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/todo/[todoId]',
      params: { todoId: 7 },
    });
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('펼친 화면에서는 이동하지 않고 옆 칸에 고른다', async () => {
    // Given
    givenWindow(700, { todoId: '5', sort: 'POPULAR' });
    const { result } = await renderHook(() => useOpenFeedTodoDetail());

    // When
    result.current(7);

    // Then
    expect(jest.mocked(router.setParams).mock.calls[0]?.[0]).toStrictEqual({
      todoId: '7',
      comment: undefined,
      sort: undefined,
    });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('펼친 화면에서 이미 고른 할 일을 다시 누르면 아무것도 바꾸지 않는다', async () => {
    // Given
    givenWindow(700, { todoId: '7', sort: 'POPULAR' });
    const { result } = await renderHook(() => useOpenFeedTodoDetail());

    // When
    result.current(7);

    // Then
    expect(router.setParams).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

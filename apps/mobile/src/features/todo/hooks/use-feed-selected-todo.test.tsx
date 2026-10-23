import { RouteSearchParamsProvider } from '@src/shared/providers/route-search-params-provider';
import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useWindowDimensions } from 'react-native';

import { useFeedSelectedTodo } from './use-feed-selected-todo';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const mockedUseWindowDimensions = jest.mocked(useWindowDimensions);

function givenWindow(width: number, params: Record<string, string> = {}) {
  mockedUseWindowDimensions.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
  mockedUseLocalSearchParams.mockReturnValue(params);
}

describe('useFeedSelectedTodo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('URL의 todoId를 숫자로 읽는다', async () => {
    // Given
    givenWindow(700, { todoId: '42' });

    // When
    const { result } = await renderHook(() => useFeedSelectedTodo());

    // Then
    expect(result.current[0]).toBe(42);
  });

  it('피드 레이아웃이 넘긴 자식 route params를 자기 route params보다 먼저 읽는다', async () => {
    // Given
    givenWindow(900, { todoId: '1' });

    // When
    const { result } = await renderHook(() => useFeedSelectedTodo(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <RouteSearchParamsProvider params={{ friendId: 'friend-1', todoId: '42' }}>
          {children}
        </RouteSearchParamsProvider>
      ),
    });

    // Then
    expect(result.current[0]).toBe(42);
  });

  it('잘못된 todoId는 선택 없음으로 본다', async () => {
    // Given
    givenWindow(700, { todoId: 'abc' });

    // When
    const { result } = await renderHook(() => useFeedSelectedTodo());

    // Then
    expect(result.current[0]).toBeUndefined();
  });

  it('compact에서는 상세 라우트로 push한다', async () => {
    // Given
    givenWindow(390);
    const { result } = await renderHook(() => useFeedSelectedTodo());

    // When
    result.current[1](7);

    // Then
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/todo/[todoId]',
      params: { todoId: 7 },
    });
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('medium 이상에서는 피드 URL param을 바꾸고 이전 댓글 상태를 지운다', async () => {
    // Given
    givenWindow(700);
    const { result } = await renderHook(() => useFeedSelectedTodo());

    // When
    result.current[1](7);

    // Then
    expect(router.setParams).toHaveBeenCalledWith({
      todoId: '7',
      comment: undefined,
      intent: undefined,
      returnTo: undefined,
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('medium 이상에서 undefined를 고르면 선택을 해제한다', async () => {
    // Given
    givenWindow(900, { todoId: '7' });
    const { result } = await renderHook(() => useFeedSelectedTodo());

    // When
    result.current[1](undefined);

    // Then
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ todoId: undefined }));
  });
});

import { mockWindowDimensions } from '@src/shared/__tests__';
import { renderHook } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useFeedSelectedTodo } from './use-feed-selected-todo';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);
function givenWindow(width: number, params: Record<string, string> = {}) {
  mockWindowDimensions(width);
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

  it('친구 피드에서도 같은 피드 화면의 todoId를 읽는다', async () => {
    // Given
    givenWindow(900, { friendId: 'friend-1', todoId: '42' });

    // When
    const { result } = await renderHook(() => useFeedSelectedTodo());

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

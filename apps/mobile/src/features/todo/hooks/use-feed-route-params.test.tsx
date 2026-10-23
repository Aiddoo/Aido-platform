import { renderHook } from '@testing-library/react-native';
import { useGlobalSearchParams, usePathname } from 'expo-router';

import { useFeedRouteParams } from './use-feed-route-params';

jest.mock('expo-router', () => ({
  useGlobalSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));

const mockedUsePathname = jest.mocked(usePathname);
const mockedUseGlobalSearchParams = jest.mocked(useGlobalSearchParams);

function givenRoute(pathname: string, params: Record<string, string>) {
  mockedUsePathname.mockReturnValue(pathname);
  mockedUseGlobalSearchParams.mockReturnValue(params);
}

describe('useFeedRouteParams', () => {
  it('피드가 앞에 있으면 자식 route의 global params를 읽는다', async () => {
    // Given
    givenRoute('/feed/friend/friend-1', { friendId: 'friend-1', todoId: '7' });

    // When
    const { result } = await renderHook(() => useFeedRouteParams());

    // Then
    expect(result.current).toEqual({ friendId: 'friend-1', todoId: '7' });
  });

  it('다른 화면이 앞에 오면 마지막 피드 params를 유지한다', async () => {
    // Given
    givenRoute('/feed', { todoId: '7', comment: 'c1' });
    const { result, rerender } = await renderHook(() => useFeedRouteParams());

    // When
    givenRoute('/todo/9', { todoId: '9' });
    await rerender({});

    // Then
    expect(result.current).toEqual({ todoId: '7', comment: 'c1' });
  });

  it('피드로 돌아오면 현재 피드 params를 다시 읽는다', async () => {
    // Given
    givenRoute('/feed', { todoId: '7' });
    const { result, rerender } = await renderHook(() => useFeedRouteParams());
    givenRoute('/memo', { id: '3' });
    await rerender({});

    // When
    givenRoute('/feed', {});
    await rerender({});

    // Then
    expect(result.current).toEqual({});
  });

  it('피드가 가려진 채로 처음 마운트되면 앞 화면의 params를 피드 것으로 보지 않는다', async () => {
    // Given
    givenRoute('/todo/7', { todoId: '7' });

    // When
    const { result } = await renderHook(() => useFeedRouteParams());

    // Then
    expect(result.current).toEqual({});
  });
});

import { renderHook } from '@testing-library/react-native';

import { useFetchNextPage } from './use-fetch-next-page';

function createParams(overrides: Partial<Parameters<typeof useFetchNextPage>[0]> = {}) {
  return {
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useFetchNextPage', () => {
  it('끝에 닿으면 다음 페이지를 한 번 부른다', async () => {
    // Given
    const params = createParams();
    const { result } = await renderHook(() => useFetchNextPage(params));

    // When
    result.current.fetchOnEndReached();

    // Then
    expect(params.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(params.fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false });
  });

  it('응답이 오기 전 빠른 스크롤로 연달아 닿아도 한 번만 부른다', async () => {
    // Given
    const params = createParams({
      fetchNextPage: jest.fn().mockReturnValue(new Promise(() => {})),
    });
    const { result } = await renderHook(() => useFetchNextPage(params));

    // When
    result.current.fetchOnEndReached();
    result.current.fetchOnEndReached();
    result.current.fetchOnEndReached();

    // Then
    expect(params.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('응답이 끝나면 다시 부를 수 있다', async () => {
    // Given
    const params = createParams();
    const { result } = await renderHook(() => useFetchNextPage(params));
    result.current.fetchOnEndReached();
    await Promise.resolve();
    await Promise.resolve();

    // When
    result.current.fetchOnEndReached();

    // Then
    expect(params.fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['다음 페이지가 없으면', { hasNextPage: false }],
    ['받는 중이면', { isFetchingNextPage: true }],
    ['직전 요청이 실패했으면', { isFetchNextPageError: true }],
  ])('%s 끝에 닿아도 부르지 않는다', async (_title, overrides) => {
    // Given
    const params = createParams(overrides);
    const { result } = await renderHook(() => useFetchNextPage(params));

    // When
    result.current.fetchOnEndReached();

    // Then
    expect(params.fetchNextPage).not.toHaveBeenCalled();
  });

  it('실패한 뒤에는 재시도로만 다시 부른다', async () => {
    // Given
    const params = createParams({ isFetchNextPageError: true });
    const { result } = await renderHook(() => useFetchNextPage(params));

    // When
    result.current.retry();

    // Then
    expect(params.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('요청이 거부돼도 오류를 밖으로 던지지 않고 다시 부를 수 있다', async () => {
    // Given
    const params = createParams({ fetchNextPage: jest.fn().mockRejectedValue(new Error('500')) });
    const { result } = await renderHook(() => useFetchNextPage(params));

    // When
    result.current.fetchOnEndReached();
    await Promise.resolve();
    await Promise.resolve();
    result.current.fetchOnEndReached();

    // Then
    expect(params.fetchNextPage).toHaveBeenCalledTimes(2);
  });
});

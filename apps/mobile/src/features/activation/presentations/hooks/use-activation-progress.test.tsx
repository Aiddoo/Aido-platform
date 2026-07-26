import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { useActivationProgress } from './use-activation-progress';

jest.mock('@src/bootstrap/providers/auth-provider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

jest.mock(
  '@src/features/feature-discovery/presentations/queries/use-feature-discovery-query-options',
  () => ({
    useFeatureDiscoveryQueryOptions: () => ({ queryKey: ['feature-discovery'] }),
  }),
);

jest.mock('@src/features/user/presentations/queries/use-get-me-query-options', () => ({
  useGetMeQueryOptions: () => ({ queryKey: ['me'] }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useActivationService: () => ({
    getProgress: jest.fn(),
  }),
}));

const mockUseQuery = jest.mocked(useQuery);

describe('useActivationProgress compatibility readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('캠페인 설정 요청이 실패해도 사용자 조회가 끝나면 기존 동작을 계속할 수 있다', async () => {
    // Given
    mockUseQuery
      .mockReturnValueOnce({
        data: undefined,
        isSuccess: false,
        isFetched: true,
        isError: true,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: {
          id: 'existing-user',
          createdAt: new Date('2026-07-31T23:59:59.999Z'),
        },
        isSuccess: true,
        isFetched: true,
      } as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: undefined,
        isSuccess: false,
        isFetched: false,
      } as ReturnType<typeof useQuery>);

    // When
    const { result } = await renderHook(() => useActivationProgress());

    // Then
    expect(result.current.isReady).toBe(true);
    expect(result.current.config).toBeUndefined();
    expect(result.current.user?.id).toBe('existing-user');
  });
});

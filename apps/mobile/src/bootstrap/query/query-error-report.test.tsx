import { ErrorCode } from '@aido/api/errors';
import { ApiError, NetworkError, ParseError } from '@src/shared/errors';
import { QueryErrorBoundary } from '@src/shared/ui/query-error-boundary';
import { createErrorReporterStub, createTestDi, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';
import { Suspense } from 'react';
import { Text } from 'react-native';

function failingQuery(error: unknown) {
  return {
    queryKey: ['query-error-report', String(error)],
    queryFn: async (): Promise<string> => {
      throw error;
    },
  };
}

function InlineBlock({ error }: { error: unknown }) {
  const { isError } = useQuery(failingQuery(error));
  return isError ? <Text>인라인 실패</Text> : null;
}

function SuspenseBlock({ error }: { error: unknown }) {
  const { data } = useSuspenseQuery(failingQuery(error));
  return <Text>{data}</Text>;
}

function ThrowingInlineBlock({ error }: { error: unknown }) {
  useQuery({ ...failingQuery(error), throwOnError: () => true });
  return null;
}

describe('QueryErrorReport', () => {
  beforeEach(() => {
    // React가 경계에 잡힌 렌더 오류를 console.error로 다시 찍는 것을 막는다
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each<[string, unknown, number]>([
    ['예상하지 못한 실패', new ParseError('invalid'), 1],
    ['서버가 코드로 거절한 실패', new ApiError(ErrorCode.TODO_0801, '없음', 404), 0],
    ['연결 끊김', new NetworkError(), 0],
  ])('경계 밖 인라인 조회의 %s는 조회 캐시 이름으로 %i건 보고한다', async (_case, error, count) => {
    // Given
    const errorReporter = createErrorReporterStub();

    // When
    await renderScreen(<InlineBlock error={error} />, {
      di: createTestDi({ ports: { errorReporter } }),
    });
    await screen.findByText('인라인 실패');

    // Then
    expect(errorReporter.captureException.mock.calls).toEqual(
      Array.from({ length: count }, () => [error, { feature: 'query_cache' }]),
    );
  });

  it('경계가 받는 조회 실패는 조회 캐시가 아니라 경계가 한 번 보고한다', async () => {
    // Given
    const errorReporter = createErrorReporterStub();
    const error = new ParseError('invalid');

    // When
    await renderScreen(
      <QueryErrorBoundary fallback={() => <Text>경계 실패</Text>}>
        <Suspense fallback={null}>
          <SuspenseBlock error={error} />
        </Suspense>
      </QueryErrorBoundary>,
      { di: createTestDi({ ports: { errorReporter } }) },
    );
    await screen.findByText('경계 실패');

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
    expect(errorReporter.captureException).toHaveBeenCalledWith(error, {
      feature: 'error_boundary',
    });
  });

  it('throwOnError 함수로 경계에 보내는 인라인 조회는 경계만 한 번 보고한다', async () => {
    // Given
    const errorReporter = createErrorReporterStub();
    const error = new ParseError('invalid');

    // When
    await renderScreen(
      <QueryErrorBoundary fallback={() => <Text>경계 실패</Text>}>
        <ThrowingInlineBlock error={error} />
      </QueryErrorBoundary>,
      { di: createTestDi({ ports: { errorReporter } }) },
    );
    await screen.findByText('경계 실패');

    // Then
    expect(errorReporter.captureException.mock.calls).toEqual([
      [error, { feature: 'error_boundary' }],
    ]);
  });

  it('데이터가 있는 Suspense 조회의 재조회 실패는 경계가 아니라 조회 캐시가 보고한다', async () => {
    // Given
    const errorReporter = createErrorReporterStub();
    const error = new ParseError('invalid');
    const query = failingQuery(error);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(query.queryKey, '받아 둔 값');
    await renderScreen(
      <QueryErrorBoundary fallback={() => <Text>경계 실패</Text>}>
        <Suspense fallback={null}>
          <SuspenseBlock error={error} />
        </Suspense>
      </QueryErrorBoundary>,
      { di: createTestDi({ ports: { errorReporter, queryClient } }) },
    );
    await screen.findByText('받아 둔 값');

    // When
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: query.queryKey });
    });

    // Then
    expect(screen.getByText('받아 둔 값')).toBeTruthy();
    expect(errorReporter.captureException.mock.calls).toEqual([
      [error, { feature: 'query_cache' }],
    ]);
  });
});

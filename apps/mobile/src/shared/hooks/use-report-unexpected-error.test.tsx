import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createErrorReporterStub, createMockDIContainer } from '@src/shared/__tests__';
import { NetworkError, ServerError } from '@src/shared/errors';
import { ApiError } from '@src/shared/errors/api-error';
import { renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useReportUnexpectedError } from './use-report-unexpected-error';

async function setup() {
  const errorReporter = createErrorReporterStub();
  const container = createMockDIContainer({ errorReporter });
  const { result } = await renderHook(() => useReportUnexpectedError('memo'), {
    wrapper: ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>{children}</StaticDIProvider>
    ),
  });
  return { errorReporter, report: result.current };
}

describe('useReportUnexpectedError', () => {
  test('서버 장애처럼 예측하지 못한 오류만 보고한다', async () => {
    // Given
    const { errorReporter, report } = await setup();

    // When
    report(new ServerError(500));

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
  });

  test('예상한 거절과 연결 문제는 보고하지 않는다', async () => {
    // Given
    const { errorReporter, report } = await setup();

    // When
    report(new ApiError('MEMO_0001', '거절', 400));
    report(new NetworkError());

    // Then
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });
});

import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createMockDIContainer } from '@src/shared/__tests__';
import { ApiError, ServerError } from '@src/shared/errors';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { QueryErrorBoundary } from './QueryErrorBoundary';

jest.mock('heroui-native', () => {
  const { View } = require('react-native');
  return {
    PressableFeedback: Object.assign(
      ({ children, ...props }: { children: ReactNode }) => <View {...props}>{children}</View>,
      { Highlight: () => null },
    ),
    Spinner: () => <View testID="spinner" />,
  };
});

const createMockErrorReporter = (): jest.Mocked<ErrorReporter> => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUserId: jest.fn(),
});

const Thrower = ({ error }: { error: Error }) => {
  throw error;
};

describe('QueryErrorBoundary 관측', () => {
  let errorReporter: jest.Mocked<ErrorReporter>;

  beforeEach(() => {
    errorReporter = createMockErrorReporter();
    // React가 잡힌 렌더 에러를 console.error로 중복 출력하는 것 억제
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderWithBoundary = (error: Error) =>
    render(
      <StaticDIProvider container={createMockDIContainer({ errorReporter })}>
        <QueryErrorBoundary>
          <Thrower error={error} />
        </QueryErrorBoundary>
      </StaticDIProvider>,
    );

  it('일시 401(auth-transition)은 에러 이벤트 대신 warning 메시지로 즉시 남긴다', () => {
    // Given — 콜드 스타트 컨테인먼트: 카드가 떠도 Sentry가 무음이면 원인 추적이 불가능하다
    const error = new ApiError('AUTH_0101', '인증 정보가 올바르지 않아요', 401);

    // When
    renderWithBoundary(error);

    // Then — 에러 이슈(PRODUCTION-3) 소음 없이, 발생 사실은 즉시 관측된다
    expect(errorReporter.captureException).not.toHaveBeenCalled();
    expect(errorReporter.captureMessage).toHaveBeenCalledWith(
      'query_boundary_auth_contained',
      expect.objectContaining({ severity: 'warning', feature: 'error_boundary' }),
    );
  });

  it('진짜 장애(재시도 소진 후)는 기존대로 에러 이벤트로 리포트한다', () => {
    // Given
    const error = new ServerError(503);

    // When
    renderWithBoundary(error);

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ feature: 'error_boundary' }),
    );
    expect(errorReporter.captureMessage).not.toHaveBeenCalled();
  });
});

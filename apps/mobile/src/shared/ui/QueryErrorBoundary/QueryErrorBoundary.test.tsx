import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { createMockDIContainer } from '@src/shared/__tests__';
import { ApiError, ServerError } from '@src/shared/errors';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { Pressable, Text } from 'react-native';

import { OverlayProvider } from '../Overlay/OverlayProvider';
import { useOverlay } from '../Overlay/useOverlay';
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

const MaybeThrower = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new ServerError(503);
  }
  return <Text testID="healthy-content">정상 화면</Text>;
};

const AsyncErrorScreen = ({ error }: { error: Error }) => {
  const { showBoundary } = useErrorBoundary();
  return (
    <Pressable onPress={() => showBoundary(error)} testID="submit-error">
      <Text>Submit</Text>
    </Pressable>
  );
};

const OverlayErrorScreen = ({ error }: { error: Error }) => {
  const overlay = useOverlay();
  return (
    <Pressable
      testID="open-error-overlay"
      onPress={() => {
        void overlay.open(() => <AsyncErrorScreen error={error} />);
      }}
    >
      <Text>Open</Text>
    </Pressable>
  );
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

  it('일시 401(auth-transition)은 에러 이벤트 대신 warning 메시지로 즉시 남긴다', async () => {
    // Given — 콜드 스타트 컨테인먼트: 카드가 떠도 Sentry가 무음이면 원인 추적이 불가능하다
    const error = new ApiError('AUTH_0101', '인증 정보가 올바르지 않아요', 401);

    // When
    await renderWithBoundary(error);

    // Then — 에러 이슈(PRODUCTION-3) 소음 없이, 발생 사실은 즉시 관측된다
    expect(errorReporter.captureException).not.toHaveBeenCalled();
    expect(errorReporter.captureMessage).toHaveBeenCalledWith(
      'query_boundary_auth_contained',
      expect.objectContaining({ severity: 'warning', feature: 'error_boundary' }),
    );
  });

  it('진짜 장애(재시도 소진 후)는 기존대로 에러 이벤트로 리포트한다', async () => {
    // Given
    const error = new ServerError(503);

    // When
    await renderWithBoundary(error);

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ feature: 'error_boundary' }),
    );
    expect(errorReporter.captureMessage).not.toHaveBeenCalled();
  });

  it('날짜 query key가 바뀌면 이전 날짜의 error fallback을 해제한다', async () => {
    const container = createMockDIContainer({ errorReporter });
    const screen = await render(
      <StaticDIProvider container={container}>
        <QueryErrorBoundary resetKeys={['2026-07-14']}>
          <MaybeThrower shouldThrow />
        </QueryErrorBoundary>
      </StaticDIProvider>,
    );
    expect(screen.queryByTestId('healthy-content')).toBeNull();

    await screen.rerender(
      <StaticDIProvider container={container}>
        <QueryErrorBoundary resetKeys={['2026-07-15']}>
          <MaybeThrower shouldThrow={false} />
        </QueryErrorBoundary>
      </StaticDIProvider>,
    );

    expect(screen.getByTestId('healthy-content')).toBeTruthy();
  });

  it('화면의 useErrorBoundary에 context를 제공하고 제출 오류를 기존 fallback에서 처리한다', async () => {
    const error = new ServerError(503);
    const screen = await render(
      <StaticDIProvider container={createMockDIContainer({ errorReporter })}>
        <QueryErrorBoundary fallback={() => <Text testID="submit-fallback">Retry</Text>}>
          <AsyncErrorScreen error={error} />
        </QueryErrorBoundary>
      </StaticDIProvider>,
    );

    await fireEvent.press(screen.getByTestId('submit-error'));

    expect(screen.getByTestId('submit-fallback')).toBeTruthy();
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ feature: 'error_boundary' }),
    );
  });

  it('OverlayProvider가 별도로 마운트한 overlay에도 오류 context를 전달한다', async () => {
    const error = new ServerError(503);
    const screen = await render(
      <StaticDIProvider container={createMockDIContainer({ errorReporter })}>
        <QueryErrorBoundary fallback={() => <Text testID="overlay-fallback">Retry</Text>}>
          <OverlayProvider>
            <OverlayErrorScreen error={error} />
          </OverlayProvider>
        </QueryErrorBoundary>
      </StaticDIProvider>,
    );

    await fireEvent.press(screen.getByTestId('open-error-overlay'));
    expect(screen.getByTestId('submit-error')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('submit-error'));

    expect(screen.getByTestId('overlay-fallback')).toBeTruthy();
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ feature: 'error_boundary' }),
    );
  });
});

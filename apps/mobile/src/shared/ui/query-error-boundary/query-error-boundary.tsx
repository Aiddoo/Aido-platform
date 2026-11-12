import { HttpStatus } from '@aido/api/errors';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { useErrorReporter } from '@src/shared/di/shared-di-context';
import {
  classifyError,
  getErrorDiagnosis,
  getErrorMessage,
  reportUnexpectedError,
} from '@src/shared/errors';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { match } from 'ts-pattern';

import { QueryErrorFallback } from './query-error-fallback';

/** 던져진 것이 Error라는 보장이 없어 error는 unknown이다. 좁히려면 shared/errors의 판별 함수를 거친다 */
export interface QueryErrorFallbackProps {
  error: unknown;
  reset: () => void;
}

interface QueryErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: QueryErrorFallbackProps) => ReactNode;
  /** 쿼리 식별자가 바뀌면 이전 식별자의 fallback 상태를 자동 해제한다. */
  resetKeys?: unknown[];
}

export function QueryErrorBoundary({ children, fallback, resetKeys }: QueryErrorBoundaryProps) {
  const errorReporter = useErrorReporter();
  const isOnline = useIsOnline();

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          // 연결이 바뀌면 다시 그린다: 오프라인이면 쿼리가 멈춰 로딩을, 복귀하면 새로 불러온다
          resetKeys={[...(resetKeys ?? []), isOnline]}
          onError={(error) => {
            reportBoundaryError(errorReporter, error);
          }}
          fallbackRender={({ error, resetErrorBoundary }) =>
            fallback ? (
              <Fallback render={fallback} error={error} reset={resetErrorBoundary} />
            ) : (
              <QueryErrorFallback reset={resetErrorBoundary} />
            )
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

/** 함수를 그대로 호출하면 React가 훅 디스패처를 걸어 주지 않아 fallback이 훅을 쓰는 순간 "Invalid hook call"로 터진다 */
function Fallback({
  render,
  ...props
}: QueryErrorFallbackProps & { render: (props: QueryErrorFallbackProps) => ReactNode }) {
  return <>{render(props)}</>;
}

/** 경계가 받은 오류를 종류마다 한 번 남긴다. 이슈는 예상하지 못한 오류뿐이다 */
function reportBoundaryError(errorReporter: ErrorReporter, error: unknown) {
  match(classifyError(error).kind)
    // 로컬에 담기는 일시적 401은 이슈 대신 warning 메시지로 남긴다. 이슈면 콜드 스타트마다 알림이 울리고, 무음이면 추적하지 못한다
    .with('auth-expired', () =>
      errorReporter.captureMessage(ERROR_REPORT_MESSAGES.QUERY_BOUNDARY_AUTH_CONTAINED, {
        severity: 'warning',
        feature: 'error_boundary',
        statusCode: HttpStatus.UNAUTHORIZED,
      }),
    )
    // 404·403(없음·볼 수 없음·기능 꺼짐)처럼 다시 해도 같은 업무 상태다. fallback이 안내한다
    .with('expected', () => {
      const { code, status } = getErrorDiagnosis(error);
      errorReporter.addBreadcrumb({
        category: 'http',
        message: 'query_boundary_expected_state',
        data: { code, statusCode: status },
      });
    })
    .with('connectivity', () =>
      errorReporter.addBreadcrumb({
        category: 'network',
        level: 'warning',
        message: 'query_boundary_connectivity',
        data: { error: getErrorMessage(error) },
      }),
    )
    .with('unexpected', () => reportUnexpectedError(errorReporter, error, 'error_boundary'))
    .exhaustive();
}

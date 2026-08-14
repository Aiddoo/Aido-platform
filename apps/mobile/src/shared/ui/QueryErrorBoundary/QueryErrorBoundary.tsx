import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { classifyBoundaryError, toError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { Result } from '../Result/Result';

interface FallbackProps {
  error: unknown;
  reset: () => void;
}

interface QueryErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: FallbackProps) => ReactNode;
  /** 쿼리 식별자가 바뀌면 이전 식별자의 fallback 상태를 자동 해제한다. */
  resetKeys?: unknown[];
}

export function QueryErrorBoundary({ children, fallback, resetKeys }: QueryErrorBoundaryProps) {
  const errorReporter = useErrorReporter();
  const { t } = useTranslation();

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={resetKeys}
          onError={(error) => {
            // 로컬에 담기는 일시적 401은 에러 이슈 대신 warning 이벤트로 남긴다 —
            // 에러로 리포트하면 콜드스타트마다 알림이 울리고, 완전 무음이면 추적이 불가능하다.
            if (classifyBoundaryError(error) === 'auth-transition') {
              errorReporter.captureMessage('query_boundary_auth_contained', {
                severity: 'warning',
                feature: 'error_boundary',
                statusCode: 401,
              });
              return;
            }
            errorReporter.captureException(toError(error), { feature: 'error_boundary' });
          }}
          fallbackRender={({ error, resetErrorBoundary }) =>
            fallback ? (
              fallback({ error, reset: resetErrorBoundary })
            ) : (
              <Result
                title={t('errorBoundary.title')}
                button={
                  <Result.Button onPress={resetErrorBoundary}>
                    {t('errorBoundary.retry')}
                  </Result.Button>
                }
              />
            )
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

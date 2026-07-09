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
}

export function QueryErrorBoundary({ children, fallback }: QueryErrorBoundaryProps) {
  const errorReporter = useErrorReporter();
  const { t } = useTranslation();

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          onError={(error) => {
            // 로컬에 담기는 일시적 401은 리포트하지 않는다 — 콜드스타트마다 Sentry가 울린다.
            if (classifyBoundaryError(error) === 'auth-transition') {
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

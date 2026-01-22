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
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) =>
            fallback ? (
              fallback({ error, reset: resetErrorBoundary })
            ) : (
              <Result
                title="오류가 발생했어요"
                button={<Result.Button onPress={resetErrorBoundary}>재시도</Result.Button>}
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

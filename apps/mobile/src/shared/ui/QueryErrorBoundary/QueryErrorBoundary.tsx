import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { classifyBoundaryError, toError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { Result } from '../Result/Result';

/**
 * 경계가 fallback에 넘겨주는 값.
 * 던져진 것이 Error라는 보장이 없어(문자열·객체 무엇이든 throw될 수 있다) error는 unknown이다 —
 * 좁히려면 shared/errors의 판별 함수를 거친다.
 */
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

/**
 * fallback을 컴포넌트 경계 안에서 그린다.
 * 함수를 그대로 호출하면 React가 훅 디스패처를 걸어 주지 않아
 * fallback이 useTranslation 같은 훅을 쓰는 순간 "Invalid hook call"로 터진다.
 */
function Fallback({
  render,
  ...props
}: QueryErrorFallbackProps & { render: (props: QueryErrorFallbackProps) => ReactNode }) {
  return <>{render(props)}</>;
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
            // 컴포넌트로 렌더한다 — 그냥 호출하면 fallback 안의 훅이 자기 자리를 못 찾는다.
            fallback ? (
              <Fallback render={fallback} error={error} reset={resetErrorBoundary} />
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

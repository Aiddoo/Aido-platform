import { useErrorReporter } from '@src/bootstrap/providers/di-context';
import { reportUnexpectedError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import { subscribeInlineQueryError } from './query-error-report-cache';

/**
 * 경계 밖 조회(인라인 `useQuery`, 데이터가 있는 재조회)의 예상하지 못한 실패를 한 번 보고한다.
 * 경계가 받는 실패는 경계가 보고하고, 같은 오류 객체를 다시 보내도 Sentry 어댑터가 한 번만 보낸다
 */
export function QueryErrorReport() {
  const queryClient = useQueryClient();
  const errorReporter = useErrorReporter();

  const report = useEffectEvent((error: unknown) => {
    reportUnexpectedError(errorReporter, error, 'query_cache');
  });

  useEffect(
    () =>
      subscribeInlineQueryError(queryClient.getQueryCache(), (error) => {
        report(error);
      }),
    [queryClient],
  );

  return null;
}

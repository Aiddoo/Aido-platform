import { useTranslation } from '@src/shared/i18n';

import { Result } from '../result/result';
import { QueryErrorActions } from './query-error-actions';
import type { QueryErrorFallbackProps } from './query-error-boundary';

/**
 * 예상하지 못한 조회 오류의 기본 화면. 오류 규칙대로 다시 시도와 문의하기 경로를 함께 준다.
 * 404처럼 예상한 상태는 기능 fallback이 "없음" 안내를 따로 그린다.
 */
export function QueryErrorFallback({ reset }: Pick<QueryErrorFallbackProps, 'reset'>) {
  const { t } = useTranslation();

  return (
    <Result
      title={t('errorBoundary.title')}
      description={t('errorBoundary.description')}
      button={<QueryErrorActions onRetry={reset} />}
    />
  );
}

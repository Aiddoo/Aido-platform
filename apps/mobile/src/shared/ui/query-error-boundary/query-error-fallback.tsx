import { useTranslation } from '@src/shared/i18n';

import { ErrorIllustration, type IllustrationSize } from '../illustration';
import { Result } from '../result/result';
import { QueryErrorActions } from './query-error-actions';
import type { QueryErrorFallbackProps as BoundaryFallbackProps } from './query-error-boundary';

interface QueryErrorFallbackProps extends Pick<BoundaryFallbackProps, 'reset'> {
  /** 무엇을 못 불러왔는지 알리는 제목. 없으면 "문제가 생겼어요" */
  title?: string;
  /** 없으면 "잠시 후 다시 시도해주세요. 계속되면 알려주세요" */
  description?: string;
  /** 시트·다이얼로그 안에서는 먼저 닫고 문의로 간다 */
  onInquiry?: () => void;
  /** 카드 같은 블록 안에서는 그림을 줄인다 */
  illustrationSize?: IllustrationSize;
  className?: string;
}

/** 404처럼 예상한 상태는 기능 fallback이 "없음" 안내를 따로 그린다 */
export function QueryErrorFallback({
  reset,
  title,
  description,
  onInquiry,
  illustrationSize = 'screen',
  className,
}: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return (
    <Result
      className={className}
      icon={<ErrorIllustration size={illustrationSize} />}
      title={title ?? t('errorBoundary.title')}
      description={description ?? t('errorBoundary.description')}
      button={
        <QueryErrorActions testID="query-error-retry" onRetry={reset} onInquiry={onInquiry} />
      }
    />
  );
}

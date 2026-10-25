import { useTranslation } from '@src/shared/i18n';
import { type QueryErrorFallbackProps, Result } from '@src/shared/ui';

import { isAiDataSharingConsentRequiredError } from '../domains/ai.error';
import { AiConsentRequiredResult } from './ai-consent-required-result';

/** AI 리포트 조회 경계의 fallback. 동의가 없으면 동의 안내를, 그 밖의 실패는 다시 시도를 보인다 */
export function AiQueryErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  if (isAiDataSharingConsentRequiredError(error)) {
    return <AiConsentRequiredResult reset={reset} />;
  }

  return (
    <Result
      title={t('errorBoundary.title')}
      button={<Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>}
    />
  );
}

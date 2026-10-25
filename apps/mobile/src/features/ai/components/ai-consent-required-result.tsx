import { useTranslation } from '@src/shared/i18n';
import { type QueryErrorFallbackProps, Result } from '@src/shared/ui';

import { useAiDataSharingConsentGate } from '../hooks/use-ai-data-sharing-consent-gate';

/**
 * AI 리포트·제안 조회가 동의 없음(AI_1311)으로 거절됐을 때 결과 대신 보인다.
 * 안내를 열어 동의하면 경계를 풀어 다시 불러온다.
 */
export function AiConsentRequiredResult({ reset }: Pick<QueryErrorFallbackProps, 'reset'>) {
  const { t } = useTranslation('ai');
  const aiConsent = useAiDataSharingConsentGate();

  const handleReview = async () => {
    if (await aiConsent.requestAgreement()) {
      reset();
    }
  };

  return (
    <Result
      title={t('consent.required.title')}
      description={t('consent.required.description')}
      button={<Result.Button onPress={handleReview}>{t('consent.required.action')}</Result.Button>}
    />
  );
}

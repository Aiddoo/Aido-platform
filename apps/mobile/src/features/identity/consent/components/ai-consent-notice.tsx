import { ConsentPolicy } from '@src/features/identity/consent/domains/consent.model';
import { useGetConsentQueryOptions } from '@src/features/identity/consent/queries/consent.queries';
import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, TextButton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';

import { useAiDataSharingConsentGate } from '../hooks/use-ai-data-sharing-consent-gate';

interface AiConsentNoticeProps {
  /** 동의하지 않아 무엇을 못 하는지. 문구는 쓰는 화면이 정한다 */
  title: string;
}

/**
 * AI 데이터 제공에 동의하지 않아 새 리포트·제안을 AI로 만들지 못할 때 보이는 안내.
 * 이미 받은 결과는 그대로 보여 주고, 안내를 열어 동의하면 다음 생성부터 AI를 쓴다.
 * 동의했거나 동의 상태를 아직 모르면 그리지 않는다.
 */
export function AiConsentNotice({ title }: AiConsentNoticeProps) {
  const { t } = useTranslation('ai');
  const { data: consent } = useQuery(useGetConsentQueryOptions());
  const aiConsent = useAiDataSharingConsentGate();

  if (consent == null || ConsentPolicy.hasAgreedToAiDataSharing(consent)) {
    return null;
  }

  return (
    <InlineAlert
      title={title}
      image={null}
      action={
        <TextButton
          size="medium"
          variant="arrow"
          onPress={() => aiConsent.requestAgreement()}
          testID="ai-consent-notice-action"
        >
          {t('consent.notice.action')}
        </TextButton>
      }
    />
  );
}

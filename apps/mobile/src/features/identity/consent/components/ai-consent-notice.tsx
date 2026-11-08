import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, TextButton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';

import { ConsentPolicy } from '../domains/consent.model';
import { useAiDataSharingConsentGate } from '../hooks/use-ai-data-sharing-consent-gate';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

interface AiConsentNoticeProps {
  /** 동의하지 않아 무엇을 못 하는지. 문구는 쓰는 화면이 정한다 */
  title: string;
}

/** 이미 받은 결과는 그대로 보이고, 동의했거나 동의 상태를 아직 모르면 그리지 않는다 */
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

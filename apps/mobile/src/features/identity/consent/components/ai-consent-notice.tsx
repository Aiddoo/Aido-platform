import { useTranslation } from '@src/shared/i18n';
import { InlineAlert, TextButton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';

import { ConsentPolicy } from '../domains/consent.model';
import { useAiDataSharingConsentGate } from '../hooks/use-ai-data-sharing-consent-gate';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

interface AiConsentNoticeProps {
  title: string;
}

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

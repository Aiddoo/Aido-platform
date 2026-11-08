import { INQUIRY_CATEGORY } from '@aido/api/vocabulary';
import { useApplicationMetadata } from '@src/bootstrap/providers/di-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { router } from 'expo-router';

import type { SubscriptionSupportFailure } from '../utils/subscription-failure.view-model';
import { toSubscriptionInquiryDraft } from '../utils/subscription-inquiry-draft';

export function useOpenSubscriptionInquiry() {
  const applicationMetadata = useApplicationMetadata();

  return useSingleTap(
    ({
      titleKey,
      diagnosticCode,
    }: Pick<SubscriptionSupportFailure, 'titleKey' | 'diagnosticCode'>) => {
      const content = toSubscriptionInquiryDraft({
        subject: t(titleKey),
        diagnosticCode,
        installation: applicationMetadata.getInstallation(),
      });
      router.push({
        pathname: '/settings/inquiry',
        params: { category: INQUIRY_CATEGORY.PAYMENT, content },
      });
    },
  );
}

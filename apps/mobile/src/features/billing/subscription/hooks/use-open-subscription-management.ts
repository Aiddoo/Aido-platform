import {
  useApplicationMetadata,
  useErrorReporter,
  useExternalLink,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';

import { SUBSCRIPTION_MANAGE_OPEN_FAILURE } from '../utils/subscription-failure.view-model';
import { createManagementUrl } from '../utils/subscription-links';
import { findSubscriptionStore } from '../utils/subscription-store';
import { useOpenSubscriptionInquiry } from './use-open-subscription-inquiry';

const STORE_EVENT_VALUES = { appStore: 'app_store', googlePlay: 'play_store' } as const;

export function useOpenSubscriptionManagement() {
  const subscriptionService = useSubscriptionService();
  const applicationMetadata = useApplicationMetadata();
  const externalLink = useExternalLink();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const openInquiry = useOpenSubscriptionInquiry();

  return useSingleTap(async () => {
    const { managementUrl, productId } = await subscriptionService.findManagementSource(
      process.env.EXPO_OS === 'android' ? 'PLAY_STORE' : 'APP_STORE',
    );
    // 스토어 구독이 없거나 서버가 준 프리미엄(프로모션·초대)이면 RevenueCat이 주소를 주지 않아 직접 만든다
    const url =
      managementUrl ??
      createManagementUrl(process.env.EXPO_OS, {
        productId,
        applicationId: applicationMetadata.getInstallation()?.applicationId ?? null,
      });

    const handleOpenFailed = (message: string) => {
      errorReporter.addBreadcrumb({
        category: 'ui',
        level: 'warning',
        message: 'subscription management open failed',
        data: {
          platform: process.env.EXPO_OS,
          hasProductId: productId != null,
          error: message,
        },
      });
      toast.error(t('subscription:subscriber.manageOpenFailed'), {
        action: {
          label: t('subscription:failure.contactSupport'),
          onPress: () => openInquiry(SUBSCRIPTION_MANAGE_OPEN_FAILURE),
        },
      });
    };

    if (url == null) {
      handleOpenFailed('Subscription management URL is unavailable');
      return;
    }
    try {
      await externalLink.open(url);
      const store = findSubscriptionStore(process.env.EXPO_OS);
      if (store != null) {
        trackEvent('subscription_management_opened', { store: STORE_EVENT_VALUES[store] });
      }
    } catch (error) {
      handleOpenFailed(getErrorMessage(error));
    }
  });
}

import {
  useApplicationMetadata,
  useErrorReporter,
  useExternalLink,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';

import { SUBSCRIPTION_MANAGE_OPEN_FAILURE } from '../utils/subscription-failure.view-model';
import { createManagementUrl } from '../utils/subscription-links';
import { useOpenSubscriptionInquiry } from './use-open-subscription-inquiry';

/** 스토어 구독 관리를 연다. 열지 못하면 문의로 잇는 안내 토스트를 띄우고 Sentry breadcrumb를 남긴다 */
export function useOpenSubscriptionManagement() {
  const subscriptionService = useSubscriptionService();
  const applicationMetadata = useApplicationMetadata();
  const externalLink = useExternalLink();
  const errorReporter = useErrorReporter();
  const toast = useAppToast();
  const openInquiry = useOpenSubscriptionInquiry();

  return useSingleTap(async () => {
    const productId =
      process.env.EXPO_OS === 'android'
        ? await subscriptionService.getActiveStoreProductId('PLAY_STORE')
        : null;
    const url = createManagementUrl(process.env.EXPO_OS, {
      productId,
      applicationId: applicationMetadata.getInstallation()?.applicationId ?? null,
    });

    try {
      if (url == null) {
        throw new Error('Subscription management URL is unavailable');
      }
      await externalLink.open(url);
    } catch (error) {
      errorReporter.addBreadcrumb({
        category: 'ui',
        level: 'warning',
        message: 'subscription management open failed',
        data: {
          platform: process.env.EXPO_OS,
          hasProductId: productId != null,
          error: getErrorMessage(error),
        },
      });
      toast.error(t('subscription:subscriber.manageOpenFailed'), {
        action: {
          label: t('subscription:failure.contactSupport'),
          onPress: () => openInquiry(SUBSCRIPTION_MANAGE_OPEN_FAILURE),
        },
      });
    }
  });
}

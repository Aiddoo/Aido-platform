import { useErrorReporter, useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';

import { SubscriptionPolicy } from '../domains/subscription.model';
import { SUBSCRIPTION_MANAGE_OPEN_FAILURE } from '../utils/view-models/subscription-failure.view-model';
import { useOpenSubscriptionInquiry } from './use-open-subscription-inquiry';

/** 스토어 구독 관리를 연다. 열지 못하면 문의로 잇는 안내 토스트를 띄우고 Sentry breadcrumb를 남긴다 */
export function useOpenSubscriptionManagement() {
  const subscriptionService = useSubscriptionService();
  const errorReporter = useErrorReporter();
  const toast = useAppToast();
  const openInquiry = useOpenSubscriptionInquiry();

  return useSingleTap(async () => {
    const productId =
      process.env.EXPO_OS === 'android'
        ? await subscriptionService.getActiveStoreProductId('PLAY_STORE')
        : null;
    const url = SubscriptionPolicy.getManagementUrl(process.env.EXPO_OS, {
      productId,
      applicationId: Application.applicationId,
    });

    try {
      if (url == null) {
        throw new Error('Subscription management URL is unavailable');
      }
      await Linking.openURL(url);
    } catch (error) {
      errorReporter.addBreadcrumb({
        category: 'ui',
        level: 'warning',
        message: 'subscription management open failed',
        data: {
          platform: process.env.EXPO_OS,
          hasProductId: productId != null,
          error: error instanceof Error ? error.message : String(error),
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

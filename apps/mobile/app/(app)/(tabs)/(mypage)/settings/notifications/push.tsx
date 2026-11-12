import { MarketingConsentSettings } from '@src/features/identity/consent/components/marketing-consent-settings';
import { MarketingPushDescription } from '@src/features/notification/components/marketing-push-description';
import { PushDeliverySettings } from '@src/features/notification/components/push-delivery-settings';
import { PushPermissionSettings } from '@src/features/notification/components/push-permission-settings';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function PushSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={PushPermissionSettings.Error}>
        <Suspense fallback={<PushPermissionSettings.Loading />}>
          <PushPermissionSettings />
        </Suspense>
      </QueryErrorBoundary>

      <QueryErrorBoundary fallback={PushDeliverySettings.Error}>
        <Suspense fallback={<PushDeliverySettings.Loading label={t('settings.sections.app')} />}>
          <PushDeliverySettings label={t('settings.sections.app')} />
        </Suspense>
      </QueryErrorBoundary>

      {/* 마케팅 수신 동의(일반 + 광고성 푸시)는 발송 설정이 아니라 수신 동의(consent)라 별도 카드로 분리 */}
      <QueryErrorBoundary fallback={MarketingConsentSettings.Error}>
        <Suspense
          fallback={<MarketingConsentSettings.Loading label={t('settings.sections.marketing')} />}
        >
          <MarketingConsentSettings
            label={t('settings.sections.marketing')}
            marketingPushDescription={MarketingPushDescription}
          />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

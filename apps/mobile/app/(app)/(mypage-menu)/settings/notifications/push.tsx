import { MarketingConsentSettings } from '@src/features/identity/consent/components/marketing-consent-settings';
import { PushPermissionStatusRow } from '@src/features/notification/components/push-permission-status-row';
import { PushDeliverySettings } from '@src/features/notification/components/settings/push-delivery-settings';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function PushSettingsScreen() {
  return (
    <SettingsScreenLayout>
      <SettingsListGroup>
        <SettingsListGroup.Content>
          <QueryErrorBoundary fallback={SettingsListGroup.Error}>
            <Suspense fallback={<PushPermissionStatusRow.Loading />}>
              <PushPermissionStatusRow />
            </Suspense>
          </QueryErrorBoundary>
        </SettingsListGroup.Content>
      </SettingsListGroup>

      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<PushDeliverySettings.Loading />}>
          <PushDeliverySettings />
        </Suspense>
      </QueryErrorBoundary>

      {/* 마케팅 수신 동의(일반 + 광고성 푸시)는 발송 설정이 아니라 수신 동의(consent)라 별도 카드로 분리 */}
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<MarketingConsentSettings.Loading />}>
          <MarketingConsentSettings />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

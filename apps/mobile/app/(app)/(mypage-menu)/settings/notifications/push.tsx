import { useGetConsentQueryOptions } from '@src/features/identity/consent/queries/get-consent-query-options';
import { useUpdateMarketingConsentMutationOptions } from '@src/features/identity/consent/queries/use-update-marketing-consent-mutation-options';
import { useUpdateMarketingPushConsentMutationOptions } from '@src/features/identity/consent/queries/use-update-marketing-push-consent-mutation-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { PushPermissionStatusRow } from '@src/features/notification/components/push-permission-status-row';
import { useUpdatePushEnabledMutationOptions } from '@src/features/notification/queries/use-update-push-enabled-mutation-options';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsCard, SettingsScreenLayout } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { Suspense } from 'react';

function PushSettingsScreen() {
  // 두 쿼리를 useSuspenseQueries로 병렬 발사 (개별 useSuspenseQuery는 첫 쿼리에서
  // suspend되어 두 번째가 직렬로 늦게 시작되는 waterfall이 생긴다)
  const [{ data: preference }, { data: consent }] = useSuspenseQueries({
    queries: [useGetPreferenceQueryOptions(), useGetConsentQueryOptions()],
  });
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const pushEnabledMutation = useMutation(useUpdatePushEnabledMutationOptions());
  const marketingMutation = useMutation(useUpdateMarketingConsentMutationOptions());
  const marketingPushMutation = useMutation(useUpdateMarketingPushConsentMutationOptions());
  const { t } = useTranslation(['notification', 'auth']);

  return (
    <>
      <SettingsCard>
        <SettingsCard.Content>
          <PushPermissionStatusRow />
        </SettingsCard.Content>
      </SettingsCard>

      <SettingsCard>
        <SettingsCard.Toggle
          label={t('settings.pushLabel')}
          description={t('settings.pushDescription')}
          isSelected={preference.pushEnabled}
          onSelectedChange={(enabled) => pushEnabledMutation.mutate({ pushEnabled: enabled })}
          isDisabled={updateMutation.isPending || pushEnabledMutation.isPending}
        />
        <SettingsCard.Separator />
        <SettingsCard.Toggle
          label={t('settings.nightPushLabel')}
          description={
            !preference.pushEnabled
              ? t('auth:preference.enablePushFirst')
              : t('settings.nightPushDescription')
          }
          isSelected={preference.nightPushEnabled}
          onSelectedChange={(enabled) => updateMutation.mutate({ nightPushEnabled: enabled })}
          isDisabled={
            !preference.pushEnabled || updateMutation.isPending || pushEnabledMutation.isPending
          }
        />
      </SettingsCard>

      {/* 마케팅 수신 동의(일반 + 광고성 푸시)는 발송 설정이 아니라 수신 동의(consent)라 별도 카드로 분리 */}
      <SettingsCard>
        <SettingsCard.Toggle
          label={t('settings.marketingLabel')}
          description={t('settings.marketingDescription')}
          isSelected={consent.marketingAgreedAt != null}
          onSelectedChange={(agreed) => marketingMutation.mutate({ agreed })}
          isDisabled={marketingMutation.isPending}
        />
        <SettingsCard.Separator />
        <SettingsCard.Toggle
          label={t('settings.marketingPushLabel')}
          description={t('settings.marketingPushDescription')}
          isSelected={consent.marketingPushAgreedAt != null}
          onSelectedChange={(agreed) => marketingPushMutation.mutate({ agreed })}
          isDisabled={marketingPushMutation.isPending}
        />
      </SettingsCard>
    </>
  );
}

PushSettingsScreen.Loading = function Loading() {
  return (
    <>
      <SettingsCard>
        <SettingsCard.ToggleSkeleton hasDescription />
      </SettingsCard>
      <SettingsCard>
        <SettingsCard.ToggleSkeleton hasDescription />
        <SettingsCard.Separator />
        <SettingsCard.ToggleSkeleton hasDescription />
      </SettingsCard>
      <SettingsCard>
        <SettingsCard.ToggleSkeleton hasDescription />
        <SettingsCard.Separator />
        <SettingsCard.ToggleSkeleton hasDescription />
      </SettingsCard>
    </>
  );
};

export default function PushSettingsRoute() {
  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsCard.Error}>
        <Suspense fallback={<PushSettingsScreen.Loading />}>
          <PushSettingsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

import { useActivationService } from '@src/bootstrap/providers/di-context';
import { unlockPushRegistrationForActivation } from '@src/features/activation/presentations/activation-mutations';
import { PreferencePolicy } from '@src/features/auth/models/auth.model';
import { useGetConsentQueryOptions } from '@src/features/auth/presentations/queries/use-get-consent-query-options';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useUpdateMarketingConsentMutationOptions } from '@src/features/auth/presentations/queries/use-update-marketing-consent-mutation-options';
import { useUpdateMarketingPushConsentMutationOptions } from '@src/features/auth/presentations/queries/use-update-marketing-push-consent-mutation-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/use-update-preference-mutation-options';
import {
  SettingsCard,
  SettingsToggle,
  ToggleSkeleton,
} from '@src/features/notification/presentations/components/settings';
import { useRegisterPushTokenMutationOptions } from '@src/features/notification/presentations/queries/use-register-push-token-mutation-options';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { useMutation, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function PushSettingsScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<PushSettingsForm.Loading />}>
            <PushSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

function PushSettingsForm() {
  // 두 쿼리를 useSuspenseQueries로 병렬 발사 (개별 useSuspenseQuery는 첫 쿼리에서
  // suspend되어 두 번째가 직렬로 늦게 시작되는 waterfall이 생긴다)
  const [{ data: preference }, { data: consent }] = useSuspenseQueries({
    queries: [useGetPreferenceQueryOptions(), useGetConsentQueryOptions()],
  });
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const registerPushMutation = useMutation(useRegisterPushTokenMutationOptions());
  const queryClient = useQueryClient();
  const activationService = useActivationService();
  const marketingMutation = useMutation(useUpdateMarketingConsentMutationOptions());
  const marketingPushMutation = useMutation(useUpdateMarketingPushConsentMutationOptions());
  const { t } = useTranslation('notification');

  return (
    <VStack gap={24}>
      <SettingsCard>
        <SettingsToggle
          label={t('settings.pushLabel')}
          description={t('settings.pushDescription')}
          isSelected={preference.pushEnabled}
          onSelectedChange={(enabled) =>
            updateMutation.mutate(
              { pushEnabled: enabled },
              {
                onSuccess: () => {
                  if (!enabled) {
                    return;
                  }
                  const handledByAutomaticGate = unlockPushRegistrationForActivation({
                    queryClient,
                    service: activationService,
                  });
                  if (!handledByAutomaticGate) {
                    registerPushMutation.mutate();
                  }
                },
              },
            )
          }
          isDisabled={updateMutation.isPending || registerPushMutation.isPending}
        />
        <Separator className="bg-gray-2" />
        <SettingsToggle
          label={t('settings.nightPushLabel')}
          description={
            PreferencePolicy.pushDisabledMessage(preference) ?? t('settings.nightPushDescription')
          }
          isSelected={preference.nightPushEnabled}
          onSelectedChange={(enabled) => updateMutation.mutate({ nightPushEnabled: enabled })}
          isDisabled={PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending}
        />
      </SettingsCard>

      {/* 마케팅 수신 동의(일반 + 광고성 푸시)는 발송 설정이 아니라 수신 동의(consent)라 별도 카드로 분리 */}
      <SettingsCard>
        <SettingsToggle
          label={t('settings.marketingLabel')}
          description={t('settings.marketingDescription')}
          isSelected={consent.marketingAgreedAt !== null}
          onSelectedChange={(agreed) => marketingMutation.mutate({ agreed })}
          isDisabled={marketingMutation.isPending}
        />
        <Separator className="bg-gray-2" />
        <SettingsToggle
          label={t('settings.marketingPushLabel')}
          description={t('settings.marketingPushDescription')}
          isSelected={consent.marketingPushAgreedAt !== null}
          onSelectedChange={(agreed) => marketingPushMutation.mutate({ agreed })}
          isDisabled={marketingPushMutation.isPending}
        />
      </SettingsCard>
    </VStack>
  );
}

PushSettingsForm.Loading = function Loading() {
  return (
    <VStack gap={24}>
      <SettingsCard>
        <ToggleSkeleton />
        <Separator className="bg-gray-2" />
        <ToggleSkeleton />
      </SettingsCard>
      <SettingsCard>
        <ToggleSkeleton />
        <Separator className="bg-gray-2" />
        <ToggleSkeleton />
      </SettingsCard>
    </VStack>
  );
};

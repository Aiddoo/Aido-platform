import { PreferencePolicy } from '@src/features/auth/models/auth.model';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/use-update-preference-mutation-options';
import {
  SettingsCard,
  SettingsToggle,
  ToggleSkeleton,
} from '@src/features/notification/presentations/components/settings';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
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
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation('notification');

  return (
    <VStack gap={24}>
      <SettingsCard>
        <SettingsToggle
          label={t('settings.pushLabel')}
          description={t('settings.pushDescription')}
          isSelected={preference.pushEnabled}
          onSelectedChange={(enabled) => updateMutation.mutate({ pushEnabled: enabled })}
          isDisabled={updateMutation.isPending}
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
    </VStack>
  );
};

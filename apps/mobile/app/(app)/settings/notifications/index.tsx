import { isWeatherEnabled, PreferencePolicy } from '@src/features/auth/models/auth.model';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/auth/presentations/queries/use-update-preference-mutation-options';
import {
  NavigationRow,
  NavigationSkeleton,
  SettingsCard,
  SettingsToggle,
  ToggleSkeleton,
} from '@src/features/notification/presentations/components/settings';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { formatReminderTime } from '@src/shared/utils/time';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function NotificationSettingsScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<NotificationSettingsForm.Loading />}>
            <NotificationSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

function NotificationSettingsForm() {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation('notification');

  const pushDisabled = PreferencePolicy.isPushDisabled(preference);

  return (
    <VStack gap={24}>
      <SettingsCard>
        <SettingsToggle
          label={t('settings.timeFormat24')}
          isSelected={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
          onSelectedChange={(enabled) =>
            updateMutation.mutate({
              timeFormat: enabled ? 'TWENTY_FOUR_HOUR' : 'TWELVE_HOUR',
            })
          }
          isDisabled={updateMutation.isPending}
        />
      </SettingsCard>

      <SettingsCard>
        <NavigationRow
          label={t('settings.pushLabel')}
          summary={preference.pushEnabled ? t('settings.on') : t('settings.off')}
          summaryEnabled={preference.pushEnabled}
          onPress={() => router.push('/settings/notifications/push')}
        />
        <Separator className="bg-gray-2" />
        <NavigationRow
          label={t('settings.weatherLabel')}
          summary={isWeatherEnabled(preference) ? t('settings.on') : t('settings.off')}
          summaryEnabled={isWeatherEnabled(preference)}
          onPress={() => router.push('/settings/notifications/weather')}
          isDisabled={pushDisabled}
        />
        <Separator className="bg-gray-2" />
        <NavigationRow
          label={t('settings.reminderLabel')}
          summary={`${formatReminderTime(preference.morningReminderHour, preference.morningReminderMinute, preference.timeFormat)} / ${formatReminderTime(preference.eveningReminderHour, preference.eveningReminderMinute, preference.timeFormat)}`}
          summaryEnabled={!pushDisabled}
          onPress={() => router.push('/settings/notifications/reminder')}
          isDisabled={pushDisabled}
        />
      </SettingsCard>
    </VStack>
  );
}

NotificationSettingsForm.Loading = function Loading() {
  return (
    <VStack gap={24}>
      <SettingsCard>
        <ToggleSkeleton />
      </SettingsCard>

      <SettingsCard>
        <NavigationSkeleton />
        <Separator className="bg-gray-2" />
        <NavigationSkeleton />
        <Separator className="bg-gray-2" />
        <NavigationSkeleton />
      </SettingsCard>
    </VStack>
  );
};

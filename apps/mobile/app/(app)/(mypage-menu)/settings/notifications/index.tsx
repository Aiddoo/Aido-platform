import { PreferencePolicy } from '@src/features/identity/preference/domains/preference.model';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatTimeOfDay } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout, Text } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense } from 'react';

function SummaryText({ isEnabled, children }: { isEnabled: boolean; children: string }) {
  return (
    <Text size="b2" className={isEnabled ? 'text-main' : 'text-gray-5'}>
      {children}
    </Text>
  );
}

function NotificationSettingsScreen() {
  const push = useSingleTap(router.push);

  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation('notification');
  const dateFormatContext = useDateFormatContext();

  const isPushDisabled = !preference.pushEnabled;
  const isWeatherEnabled = PreferencePolicy.isWeatherEnabled(preference);

  return (
    <>
      <SettingsListGroup>
        <SettingsListGroup.Toggle
          label={t('settings.timeFormat24')}
          isSelected={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
          onSelectedChange={(isEnabled) =>
            updateMutation.mutate({
              timeFormat: isEnabled ? 'TWENTY_FOUR_HOUR' : 'TWELVE_HOUR',
            })
          }
          isDisabled={updateMutation.isPending}
        />
      </SettingsListGroup>

      <SettingsListGroup>
        <SettingsListGroup.Item
          label={t('settings.pushLabel')}
          value={
            <SummaryText isEnabled={preference.pushEnabled}>
              {preference.pushEnabled ? t('settings.on') : t('settings.off')}
            </SummaryText>
          }
          onPress={() => push('/settings/notifications/push')}
        />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item
          label={t('settings.weatherLabel')}
          value={
            <SummaryText isEnabled={isWeatherEnabled}>
              {isWeatherEnabled ? t('settings.on') : t('settings.off')}
            </SummaryText>
          }
          onPress={() => push('/settings/notifications/weather')}
          isDisabled={isPushDisabled}
        />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item
          label={t('settings.reminderLabel')}
          value={
            <SummaryText isEnabled={!isPushDisabled}>
              {[
                { hour: preference.morningReminderHour, minute: preference.morningReminderMinute },
                { hour: preference.eveningReminderHour, minute: preference.eveningReminderMinute },
              ]
                .map((time) => formatTimeOfDay(time, preference.timeFormat, dateFormatContext))
                .join(' / ')}
            </SummaryText>
          }
          onPress={() => push('/settings/notifications/reminder')}
          isDisabled={isPushDisabled}
        />
      </SettingsListGroup>
    </>
  );
}

NotificationSettingsScreen.Loading = function Loading() {
  return (
    <>
      <SettingsListGroup>
        <SettingsListGroup.ToggleSkeleton />
      </SettingsListGroup>

      <SettingsListGroup>
        <SettingsListGroup.ItemSkeleton hasValue />
        <SettingsListGroup.Separator />
        <SettingsListGroup.ItemSkeleton hasValue />
        <SettingsListGroup.Separator />
        <SettingsListGroup.ItemSkeleton hasValue />
      </SettingsListGroup>
    </>
  );
};

export default function NotificationSettingsRoute() {
  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<NotificationSettingsScreen.Loading />}>
          <NotificationSettingsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

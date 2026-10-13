import { SettingsCard } from '@src/features/notification/components/settings/settings-card';
import { GroupSkeleton } from '@src/features/notification/components/settings/settings-skeleton';
import {
  type ClockTime,
  SettingsTimeInput,
} from '@src/features/notification/components/settings/settings-time-input';
import {
  type Preference,
  PreferencePolicy,
} from '@src/features/preference/domains/preference.model';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/preference/queries/use-update-preference-mutation-options';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import {
  CrownIcon,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function ReminderSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<GroupSkeleton rows={2} />}>
            <VStack gap={24}>
              <SettingsCard>
                <ReminderTimeInput
                  label={t('settings.reminderMorningLabel')}
                  description={t('settings.reminderMorningDescription')}
                  period="morning"
                />
                <Separator className="bg-gray-2" />
                <ReminderTimeInput
                  label={t('settings.reminderEveningLabel')}
                  description={t('settings.reminderEveningDescription')}
                  period="evening"
                />
              </SettingsCard>
            </VStack>
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

const REMINDER_TIME = {
  morning: {
    range: { minimumTime: { hour: 0, minute: 0 }, maximumTime: { hour: 11, minute: 59 } },
    read: (preference: Preference): ClockTime => ({
      hour: preference.morningReminderHour,
      minute: preference.morningReminderMinute,
    }),
    toInput: ({ hour, minute }: ClockTime) => ({
      morningReminderHour: hour,
      morningReminderMinute: minute,
    }),
  },
  evening: {
    range: { minimumTime: { hour: 12, minute: 0 }, maximumTime: { hour: 23, minute: 59 } },
    read: (preference: Preference): ClockTime => ({
      hour: preference.eveningReminderHour,
      minute: preference.eveningReminderMinute,
    }),
    toInput: ({ hour, minute }: ClockTime) => ({
      eveningReminderHour: hour,
      eveningReminderMinute: minute,
    }),
  },
} as const;

function ReminderTimeInput({
  label,
  description,
  period,
}: {
  label: string;
  description: string;
  period: keyof typeof REMINDER_TIME;
}) {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const [{ data: user }, { data: preference }] = useSuspenseQueries({
    queries: [useGetMeQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());
  const isPremium = UserPolicy.isPremiumUser(user);
  const time = REMINDER_TIME[period];

  return (
    <SettingsTimeInput
      label={label}
      description={description}
      value={time.read(preference)}
      onChange={(value) => updatePreference.mutate(time.toInput(value))}
      {...time.range}
      timeFormat={preference.timeFormat}
      isDisabled={PreferencePolicy.isPushDisabled(preference) || updatePreference.isPending}
      accessory={isPremium ? undefined : <CrownIcon width={14} height={14} />}
      onBeforeOpen={() => {
        if (isPremium) {
          return true;
        }
        trackEvent('premium_gate_shown', { feature: 'reminder_time' });
        premiumDialog.open({ description: t('settings.reminderPremium') });
        return false;
      }}
    />
  );
}

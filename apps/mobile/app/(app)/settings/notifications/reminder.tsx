import { PreferencePolicy } from '@src/features/auth/models/auth.model';
import {
  GroupSkeleton,
  SettingsCard,
  SettingsTimePicker,
} from '@src/features/notification/presentations/components/settings';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
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
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function ReminderSettingsScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<ReminderSettingsForm.Loading />}>
            <ReminderSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

function ReminderSettingsForm() {
  const { t } = useTranslation('notification');
  return (
    <VStack gap={24}>
      <SettingsCard>
        <ReminderTimePicker
          label={t('settings.reminderMorningLabel')}
          description={t('settings.reminderMorningDescription')}
          field="morning"
        />
        <Separator className="bg-gray-2" />
        <ReminderTimePicker
          label={t('settings.reminderEveningLabel')}
          description={t('settings.reminderEveningDescription')}
          field="evening"
        />
      </SettingsCard>
    </VStack>
  );
}

ReminderSettingsForm.Loading = function Loading() {
  return <GroupSkeleton rows={2} />;
};

function ReminderTimePicker({
  label,
  description,
  field,
}: {
  label: string;
  description: string;
  field: 'morning' | 'evening';
}) {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();
  const { t } = useTranslation('notification');

  return (
    <SettingsTimePicker
      label={label}
      description={description}
      field={field}
      getHour={(p) => (field === 'morning' ? p.morningReminderHour : p.eveningReminderHour)}
      getMinute={(p) => (field === 'morning' ? p.morningReminderMinute : p.eveningReminderMinute)}
      buildMutationInput={(h, m) =>
        field === 'morning'
          ? { morningReminderHour: h, morningReminderMinute: m }
          : { eveningReminderHour: h, eveningReminderMinute: m }
      }
      isDisabled={PreferencePolicy.isPushDisabled}
      onBeforeOpen={() => {
        if (!UserPolicy.isPremiumUser(user)) {
          trackEvent('premium_gate_shown', { feature: 'reminder_time' });
          premiumDialog.open({
            description: t('settings.reminderPremium'),
          });
          return false;
        }
        return true;
      }}
      accessory={!UserPolicy.isPremiumUser(user) ? <CrownIcon width={14} height={14} /> : undefined}
    />
  );
}

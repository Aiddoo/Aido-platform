import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import type { Preference } from '@src/features/identity/preference/schemas/preference.schema';
import { TimeRowSkeleton } from '@src/features/notification/components/settings/settings-skeleton';
import {
  type ClockTime,
  SettingsTimeInput,
} from '@src/features/notification/components/settings/settings-time-input';
import { SETTINGS_TIME_RANGE } from '@src/features/notification/constants/notification.constants';
import { useTranslation } from '@src/shared/i18n';
import {
  CrownIcon,
  QueryErrorBoundary,
  SettingsListGroup,
  SettingsScreenLayout,
} from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import { Suspense } from 'react';

export default function ReminderSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<ReminderSettingsLoading />}>
          <SettingsListGroup>
            <SettingsListGroup.Content>
              <ReminderTimeInput
                label={t('settings.reminderMorningLabel')}
                description={t('settings.reminderMorningDescription')}
                period="morning"
              />
            </SettingsListGroup.Content>
            <SettingsListGroup.Separator />
            <SettingsListGroup.Content>
              <ReminderTimeInput
                label={t('settings.reminderEveningLabel')}
                description={t('settings.reminderEveningDescription')}
                period="evening"
              />
            </SettingsListGroup.Content>
          </SettingsListGroup>
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

function ReminderSettingsLoading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.Content>
        <TimeRowSkeleton />
      </SettingsListGroup.Content>
      <SettingsListGroup.Separator />
      <SettingsListGroup.Content>
        <TimeRowSkeleton />
      </SettingsListGroup.Content>
    </SettingsListGroup>
  );
}

const REMINDER_TIME = {
  morning: {
    range: SETTINGS_TIME_RANGE.morning,
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
    range: SETTINGS_TIME_RANGE.evening,
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
  const gate = useEntitlementGate('CUSTOM_REMINDER_TIME', { surface: 'reminder_settings' });
  const [{ data: entitlements }, { data: preference }] = useSuspenseQueries({
    queries: [useGetEntitlementsQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());
  const isLocked = EntitlementPolicy.isFeatureLocked(entitlements, 'CUSTOM_REMINDER_TIME');
  const time = REMINDER_TIME[period];

  return (
    <SettingsTimeInput
      label={label}
      description={description}
      value={time.read(preference)}
      onChange={(value) => updatePreference.mutate(time.toInput(value))}
      {...time.range}
      timeFormat={preference.timeFormat}
      isDisabled={!preference.pushEnabled || updatePreference.isPending}
      accessory={isLocked ? <CrownIcon width={14} height={14} /> : undefined}
      onBeforeOpen={() => gate.guard()}
    />
  );
}

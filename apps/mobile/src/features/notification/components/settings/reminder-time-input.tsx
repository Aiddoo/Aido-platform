import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import type { Preference } from '@src/features/identity/preference/schemas/preference.schema';
import { CrownFilledIcon } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { SETTINGS_TIME_RANGE } from '../../constants/notification.constants';
import { type ClockTime, SettingsTimeInput } from './settings-time-input';

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

interface ReminderTimeInputProps extends Pick<
  ComponentProps<typeof SettingsTimeInput>,
  'label' | 'description'
> {
  period: keyof typeof REMINDER_TIME;
}

export function ReminderTimeInput({ label, description, period }: ReminderTimeInputProps) {
  const gate = useEntitlementGate('CUSTOM_REMINDER_TIME', { surface: 'reminder_settings' });
  const [{ data: entitlements }, { data: preference }] = useSuspenseQueries({
    queries: [useGetEntitlementsQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());
  const canUseCustomTime = EntitlementPolicy.canUseFeature(entitlements, 'CUSTOM_REMINDER_TIME');
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
      accessory={canUseCustomTime ? undefined : <CrownFilledIcon width={14} height={14} />}
      onBeforeOpen={() => !gate.promptIfBlocked()}
    />
  );
}

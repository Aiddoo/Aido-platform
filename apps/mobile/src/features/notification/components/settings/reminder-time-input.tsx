import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { type Preference } from '@src/features/identity/preference/domains/preference.model';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import type { TimeOfDay } from '@src/shared/date/time-of-day';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { CrownFilledIcon } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { SETTINGS_TIME_RANGE } from '../../constants/notification.constants';
import { SettingsTimeInput } from './settings-time-input';

const CROWN_SIZE = 14;

const REMINDER_TIME = {
  morning: {
    range: SETTINGS_TIME_RANGE.morning,
    read: (preference: Preference): TimeOfDay => ({
      hour: preference.morningReminderHour,
      minute: preference.morningReminderMinute,
    }),
    toInput: ({ hour, minute }: TimeOfDay) => ({
      morningReminderHour: hour,
      morningReminderMinute: minute,
    }),
  },
  evening: {
    range: SETTINGS_TIME_RANGE.evening,
    read: (preference: Preference): TimeOfDay => ({
      hour: preference.eveningReminderHour,
      minute: preference.eveningReminderMinute,
    }),
    toInput: ({ hour, minute }: TimeOfDay) => ({
      eveningReminderHour: hour,
      eveningReminderMinute: minute,
    }),
  },
} as const;

interface ReminderTimeInputProps extends Omit<
  ComponentProps<typeof SettingsTimeInput>,
  | 'value'
  | 'onChange'
  | 'minimumTime'
  | 'maximumTime'
  | 'timeFormat'
  | 'isDisabled'
  | 'accessory'
  | 'onBeforeOpen'
> {
  period: keyof typeof REMINDER_TIME;
}

export function ReminderTimeInput({ period, ...props }: ReminderTimeInputProps) {
  const gate = useEntitlementGate('CUSTOM_REMINDER_TIME', { surface: 'reminder_settings' });
  const [{ data: entitlements }, { data: preference }] = useSuspenseQueries({
    queries: [useGetEntitlementsQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());
  const canUseCustomTime = EntitlementPolicy.canUseFeature(entitlements, 'CUSTOM_REMINDER_TIME');
  const time = REMINDER_TIME[period];
  const fontScaledSize = useFontScaledSize();
  const crownSize = fontScaledSize(CROWN_SIZE);

  return (
    <SettingsTimeInput
      {...props}
      value={time.read(preference)}
      onChange={(value) => updatePreference.mutate(time.toInput(value))}
      {...time.range}
      timeFormat={preference.timeFormat}
      isDisabled={!preference.pushEnabled || updatePreference.isPending}
      accessory={
        canUseCustomTime ? undefined : <CrownFilledIcon width={crownSize} height={crownSize} />
      }
      onBeforeOpen={() => !gate.promptIfBlocked()}
    />
  );
}

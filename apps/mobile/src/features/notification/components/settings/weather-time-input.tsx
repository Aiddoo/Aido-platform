import { PreferencePolicy } from '@src/features/identity/preference/domains/preference.model';
import { type Preference } from '@src/features/identity/preference/domains/preference.model';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { SETTINGS_TIME_RANGE } from '../../constants/notification.constants';
import { type ClockTime, SettingsTimeInput } from './settings-time-input';

const WEATHER_TIME = {
  morning: {
    range: SETTINGS_TIME_RANGE.morning,
    read: (preference: Preference): ClockTime => ({
      hour: preference.weatherMorningHour,
      minute: preference.weatherMorningMinute,
    }),
    toInput: ({ hour, minute }: ClockTime) => ({
      weatherMorningHour: hour,
      weatherMorningMinute: minute,
    }),
  },
  evening: {
    range: SETTINGS_TIME_RANGE.evening,
    read: (preference: Preference): ClockTime => ({
      hour: preference.weatherEveningHour,
      minute: preference.weatherEveningMinute,
    }),
    toInput: ({ hour, minute }: ClockTime) => ({
      weatherEveningHour: hour,
      weatherEveningMinute: minute,
    }),
  },
} as const;

interface WeatherTimeInputProps extends Pick<
  ComponentProps<typeof SettingsTimeInput>,
  'label' | 'description'
> {
  period: keyof typeof WEATHER_TIME;
}

export function WeatherTimeInput({ label, description, period }: WeatherTimeInputProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());
  const time = WEATHER_TIME[period];

  return (
    <SettingsTimeInput
      label={label}
      description={description}
      value={time.read(preference)}
      onChange={(value) => updatePreference.mutate(time.toInput(value))}
      {...time.range}
      timeFormat={preference.timeFormat}
      isDisabled={!PreferencePolicy.canDeliverWeather(preference) || updatePreference.isPending}
    />
  );
}

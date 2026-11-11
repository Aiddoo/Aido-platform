import {
  type Preference,
  PreferencePolicy,
} from '@src/features/identity/preference/domains/preference.model';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import type { TimeOfDay } from '@src/shared/date/time-of-day';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { SETTINGS_TIME_RANGE } from '../../constants/notification.constants';
import { SettingsTimeInput } from './settings-time-input';

const WEATHER_TIME = {
  morning: {
    range: SETTINGS_TIME_RANGE.weather,
    read: (preference: Preference): TimeOfDay => ({
      hour: preference.weatherMorningHour,
      minute: preference.weatherMorningMinute,
    }),
    toInput: ({ hour, minute }: TimeOfDay) => ({
      weatherMorningHour: hour,
      weatherMorningMinute: minute,
    }),
  },
  evening: {
    range: SETTINGS_TIME_RANGE.weather,
    read: (preference: Preference): TimeOfDay => ({
      hour: preference.weatherEveningHour,
      minute: preference.weatherEveningMinute,
    }),
    toInput: ({ hour, minute }: TimeOfDay) => ({
      weatherEveningHour: hour,
      weatherEveningMinute: minute,
    }),
  },
} as const;

interface WeatherTimeInputProps extends Omit<
  ComponentProps<typeof SettingsTimeInput>,
  'value' | 'onChange' | 'minimumTime' | 'maximumTime' | 'timeFormat' | 'isDisabled'
> {
  period: keyof typeof WEATHER_TIME;
}

export function WeatherTimeInput({ period, ...props }: WeatherTimeInputProps) {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());
  const time = WEATHER_TIME[period];

  return (
    <SettingsTimeInput
      {...props}
      value={time.read(preference)}
      onChange={(value) => updatePreference.mutate(time.toInput(value))}
      {...time.range}
      timeFormat={preference.timeFormat}
      isDisabled={!PreferencePolicy.canDeliverWeather(preference) || updatePreference.isPending}
    />
  );
}

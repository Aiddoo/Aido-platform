import { PreferencePolicy } from '@src/features/identity/preference/domains/preference.model';
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
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

function WeatherSettingsScreen() {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation(['notification', 'auth']);

  const isDisabled = !preference.pushEnabled || updateMutation.isPending;

  return (
    <SettingsListGroup>
      <SettingsListGroup.Toggle
        label={t('settings.weatherLabel')}
        description={
          preference.pushEnabled
            ? t('settings.weatherDescription')
            : t('auth:preference.enablePushFirst')
        }
        isSelected={PreferencePolicy.isWeatherEnabled(preference)}
        onSelectedChange={(enabled) =>
          updateMutation.mutate({
            weatherMorningEnabled: enabled,
            weatherEveningEnabled: enabled,
            trackAs: 'weatherEnabled',
          })
        }
        isDisabled={isDisabled}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Content>
        <WeatherTimeInput
          label={t('settings.weatherMorningLabel')}
          description={t('settings.weatherMorningDescription')}
          period="morning"
        />
      </SettingsListGroup.Content>
      <SettingsListGroup.Separator />
      <SettingsListGroup.Content>
        <WeatherTimeInput
          label={t('settings.weatherEveningLabel')}
          description={t('settings.weatherEveningDescription')}
          period="evening"
        />
      </SettingsListGroup.Content>
    </SettingsListGroup>
  );
}

WeatherSettingsScreen.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.ToggleSkeleton hasDescription />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Content>
        <TimeRowSkeleton />
      </SettingsListGroup.Content>
      <SettingsListGroup.Separator />
      <SettingsListGroup.Content>
        <TimeRowSkeleton />
      </SettingsListGroup.Content>
    </SettingsListGroup>
  );
};

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

function WeatherTimeInput({
  label,
  description,
  period,
}: {
  label: string;
  description: string;
  period: keyof typeof WEATHER_TIME;
}) {
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
      isDisabled={PreferencePolicy.isWeatherDisabled(preference) || updatePreference.isPending}
    />
  );
}

export default function WeatherSettingsRoute() {
  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<WeatherSettingsScreen.Loading />}>
          <WeatherSettingsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

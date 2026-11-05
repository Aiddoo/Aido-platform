import { TimeRowSkeleton } from '@src/features/notification/components/settings/settings-skeleton';
import {
  type ClockTime,
  SettingsTimeInput,
} from '@src/features/notification/components/settings/settings-time-input';
import { SETTINGS_TIME_RANGE } from '@src/features/notification/constants/settings-time-range';
import {
  type Preference,
  PreferencePolicy,
} from '@src/features/preference/domains/preference.model';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useUpdatePreferenceMutationOptions } from '@src/features/preference/queries/use-update-preference-mutation-options';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsCard, SettingsScreenLayout } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

function WeatherSettingsScreen() {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation(['notification', 'auth']);

  const pushDisabled = PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending;

  return (
    <SettingsCard>
      <SettingsCard.Toggle
        label={t('settings.weatherLabel')}
        description={
          PreferencePolicy.isPushDisabled(preference)
            ? t('auth:preference.enablePushFirst')
            : t('settings.weatherDescription')
        }
        isSelected={PreferencePolicy.isWeatherEnabled(preference)}
        onSelectedChange={(enabled) =>
          updateMutation.mutate({
            weatherMorningEnabled: enabled,
            weatherEveningEnabled: enabled,
            trackAs: 'weatherEnabled',
          })
        }
        isDisabled={pushDisabled}
      />
      <SettingsCard.Separator />
      <SettingsCard.Content>
        <WeatherTimeInput
          label={t('settings.weatherMorningLabel')}
          description={t('settings.weatherMorningDescription')}
          period="morning"
        />
      </SettingsCard.Content>
      <SettingsCard.Separator />
      <SettingsCard.Content>
        <WeatherTimeInput
          label={t('settings.weatherEveningLabel')}
          description={t('settings.weatherEveningDescription')}
          period="evening"
        />
      </SettingsCard.Content>
    </SettingsCard>
  );
}

WeatherSettingsScreen.Loading = function Loading() {
  return (
    <SettingsCard>
      <SettingsCard.ToggleSkeleton hasDescription />
      <SettingsCard.Separator />
      <SettingsCard.Content>
        <TimeRowSkeleton />
      </SettingsCard.Content>
      <SettingsCard.Separator />
      <SettingsCard.Content>
        <TimeRowSkeleton />
      </SettingsCard.Content>
    </SettingsCard>
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
      <QueryErrorBoundary fallback={SettingsCard.Error}>
        <Suspense fallback={<WeatherSettingsScreen.Loading />}>
          <WeatherSettingsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

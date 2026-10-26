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
import {
  QueryErrorBoundary,
  SettingsCard,
  Spacing,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

function WeatherSettingsScreen() {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  const { t } = useTranslation(['notification', 'auth']);

  const pushDisabled = PreferencePolicy.isPushDisabled(preference) || updateMutation.isPending;

  return (
    <VStack gap={24}>
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
        <Separator className="bg-gray-2" />
        <WeatherTimeInput
          label={t('settings.weatherMorningLabel')}
          description={t('settings.weatherMorningDescription')}
          period="morning"
        />
        <Separator className="bg-gray-2" />
        <WeatherTimeInput
          label={t('settings.weatherEveningLabel')}
          description={t('settings.weatherEveningDescription')}
          period="evening"
        />
      </SettingsCard>
    </VStack>
  );
}

WeatherSettingsScreen.Loading = function Loading() {
  return (
    <VStack gap={24}>
      <SettingsCard>
        <SettingsCard.ToggleSkeleton hasDescription />
        <Separator className="bg-gray-2" />
        <TimeRowSkeleton />
        <Separator className="bg-gray-2" />
        <TimeRowSkeleton />
      </SettingsCard>
    </VStack>
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
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={20} />
          <QueryErrorBoundary>
            <Suspense fallback={<WeatherSettingsScreen.Loading />}>
              <WeatherSettingsScreen />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

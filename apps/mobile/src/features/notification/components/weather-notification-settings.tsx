import {
  type Preference,
  PreferencePolicy,
} from '@src/features/identity/preference/domains/preference.model';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import type { TimeOfDay } from '@src/shared/date/time-of-day';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  SettingsListGroup,
  SettingsScreenLayout,
  WeatherDuoIcon,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { type ComponentProps, Suspense } from 'react';

import { SETTINGS_TIME_RANGE } from '../constants/notification.constants';
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

/** 마이 탭 알림 설정과 날씨 화면 종 버튼이 같은 화면을 각자의 Stack에 연다. 날씨에서 열면 뒤로 가기가 날씨로 돌아간다 */
export function WeatherNotificationSettings() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={WeatherNotificationSettings.Error}>
        <Suspense fallback={<WeatherNotificationSettings.Loading />}>
          <SettingsListGroup>
            <WeatherNotificationSettings.EnabledToggle />
          </SettingsListGroup>

          <SettingsListGroup label={t('settings.sections.times')}>
            <WeatherNotificationSettings.TimeInput
              label={t('settings.weatherMorningLabel')}
              description={t('settings.weatherMorningDescription')}
              period="morning"
            />
            <SettingsListGroup.Separator />
            <WeatherNotificationSettings.TimeInput
              label={t('settings.weatherEveningLabel')}
              description={t('settings.weatherEveningDescription')}
              period="evening"
            />
          </SettingsListGroup>
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

WeatherNotificationSettings.EnabledToggle = function EnabledToggle() {
  const { t } = useTranslation(['notification', 'auth']);
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());

  return (
    <SettingsListGroup.Toggle
      icon={<SettingsListGroup.Icon Icon={WeatherDuoIcon} />}
      label={t('settings.weatherLabel')}
      description={
        preference.pushEnabled
          ? t('settings.weatherDescription')
          : t('auth:preference.enablePushFirst')
      }
      isSelected={PreferencePolicy.isWeatherEnabled(preference)}
      onSelectedChange={(enabled) =>
        updatePreference.mutate({
          weatherMorningEnabled: enabled,
          weatherEveningEnabled: enabled,
          trackAs: { setting: 'weatherEnabled', value: enabled },
        })
      }
      isDisabled={!preference.pushEnabled || updatePreference.isPending}
    />
  );
};

WeatherNotificationSettings.TimeInput = function TimeInput({
  period,
  ...props
}: WeatherTimeInputProps) {
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
};

WeatherNotificationSettings.Loading = function Loading() {
  const { t } = useTranslation('notification');

  return (
    <>
      <SettingsListGroup>
        <SettingsListGroup.Toggle.Loading hasDescription />
      </SettingsListGroup>

      <SettingsListGroup label={t('settings.sections.times')}>
        <SettingsListGroup.Item.Loading descriptionLines={1} hasValue />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item.Loading descriptionLines={1} hasValue />
      </SettingsListGroup>
    </>
  );
};

WeatherNotificationSettings.Error = SettingsListGroup.Error;

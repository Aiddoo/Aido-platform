import { WeatherEnabledToggle } from '@src/features/notification/components/settings/weather-enabled-toggle';
import { WeatherTimeInput } from '@src/features/notification/components/settings/weather-time-input';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function WeatherSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={WeatherSettingsScreen.Error}>
        <Suspense fallback={<WeatherSettingsScreen.Loading />}>
          <SettingsListGroup>
            <WeatherEnabledToggle />
          </SettingsListGroup>

          <SettingsListGroup label={t('settings.sections.times')}>
            <WeatherTimeInput
              label={t('settings.weatherMorningLabel')}
              description={t('settings.weatherMorningDescription')}
              period="morning"
            />
            <SettingsListGroup.Separator />
            <WeatherTimeInput
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

WeatherSettingsScreen.Loading = function Loading() {
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

WeatherSettingsScreen.Error = SettingsListGroup.Error;

import { SettingsTimeInput } from '@src/features/notification/components/settings/settings-time-input';
import { WeatherEnabledToggle } from '@src/features/notification/components/settings/weather-enabled-toggle';
import { WeatherTimeInput } from '@src/features/notification/components/settings/weather-time-input';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function WeatherSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<WeatherSettingsScreen.Loading />}>
          <SettingsListGroup>
            <WeatherEnabledToggle />

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
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

WeatherSettingsScreen.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.Toggle.Loading hasDescription />

      <SettingsListGroup.Separator />

      <SettingsListGroup.Content>
        <SettingsTimeInput.Loading />
      </SettingsListGroup.Content>

      <SettingsListGroup.Separator />

      <SettingsListGroup.Content>
        <SettingsTimeInput.Loading />
      </SettingsListGroup.Content>
    </SettingsListGroup>
  );
};

import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

import { WeatherEnabledToggle } from './weather-enabled-toggle';
import { WeatherTimeInput } from './weather-time-input';

/** 마이 탭 알림 설정과 날씨 화면 종 버튼이 같은 화면을 각자의 Stack에 연다. 날씨에서 열면 뒤로 가기가 날씨로 돌아간다 */
export function WeatherNotificationSettings() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={WeatherNotificationSettings.Error}>
        <Suspense fallback={<WeatherNotificationSettings.Loading />}>
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

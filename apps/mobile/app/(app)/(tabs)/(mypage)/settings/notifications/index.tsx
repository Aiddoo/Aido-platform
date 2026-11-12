import { NotificationSettingsLinks } from '@src/features/notification/components/notification-settings-links';
import { TimeFormatSetting } from '@src/features/notification/components/time-format-setting';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function NotificationSettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={NotificationSettingsScreen.Error}>
        <Suspense fallback={<NotificationSettingsScreen.Loading />}>
          <NotificationSettingsLinks label={t('sections.notifications')} />

          <TimeFormatSetting label={t('sections.timeDisplay')} />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

NotificationSettingsScreen.Loading = function Loading() {
  const { t } = useTranslation('settings');

  return (
    <>
      <NotificationSettingsLinks.Loading label={t('sections.notifications')} />

      <SettingsListGroup label={t('sections.timeDisplay')}>
        <SettingsListGroup.Toggle.Loading />
      </SettingsListGroup>
    </>
  );
};

NotificationSettingsScreen.Error = SettingsListGroup.Error;

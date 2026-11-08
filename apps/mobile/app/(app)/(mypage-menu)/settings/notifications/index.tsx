import { NotificationSettingsLinks } from '@src/features/notification/components/settings/notification-settings-links';
import { TimeFormatSetting } from '@src/features/notification/components/settings/time-format-setting';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function NotificationSettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<NotificationSettingsScreen.Loading />}>
          <TimeFormatSetting label={t('sections.timeDisplay')} />

          <NotificationSettingsLinks label={t('sections.notifications')} />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

NotificationSettingsScreen.Loading = function Loading() {
  const { t } = useTranslation('settings');

  return (
    <>
      <SettingsListGroup label={t('sections.timeDisplay')}>
        <SettingsListGroup.Toggle.Loading />
      </SettingsListGroup>

      <SettingsListGroup label={t('sections.notifications')}>
        <SettingsListGroup.Item.Loading hasValue />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item.Loading hasValue />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item.Loading hasValue />
      </SettingsListGroup>
    </>
  );
};

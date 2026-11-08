import { NotificationSettingsLinks } from '@src/features/notification/components/settings/notification-settings-links';
import { TimeFormatSetting } from '@src/features/notification/components/settings/time-format-setting';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function NotificationSettingsScreen() {
  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<NotificationSettingsScreen.Loading />}>
          <TimeFormatSetting />

          <NotificationSettingsLinks />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

NotificationSettingsScreen.Loading = function Loading() {
  return (
    <>
      <SettingsListGroup>
        <SettingsListGroup.Toggle.Loading />
      </SettingsListGroup>

      <SettingsListGroup>
        <SettingsListGroup.Item.Loading hasValue />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item.Loading hasValue />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item.Loading hasValue />
      </SettingsListGroup>
    </>
  );
};

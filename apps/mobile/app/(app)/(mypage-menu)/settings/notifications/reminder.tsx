import { ReminderTimeInput } from '@src/features/notification/components/settings/reminder-time-input';
import { SettingsTimeInput } from '@src/features/notification/components/settings/settings-time-input';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function ReminderSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<ReminderSettingsScreen.Loading />}>
          <SettingsListGroup>
            <SettingsListGroup.Content>
              <ReminderTimeInput
                label={t('settings.reminderMorningLabel')}
                description={t('settings.reminderMorningDescription')}
                period="morning"
              />
            </SettingsListGroup.Content>

            <SettingsListGroup.Separator />

            <SettingsListGroup.Content>
              <ReminderTimeInput
                label={t('settings.reminderEveningLabel')}
                description={t('settings.reminderEveningDescription')}
                period="evening"
              />
            </SettingsListGroup.Content>
          </SettingsListGroup>
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

ReminderSettingsScreen.Loading = function Loading() {
  return (
    <SettingsListGroup>
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

import { ReminderTimeInput } from '@src/features/notification/components/reminder-time-input';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function ReminderSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={ReminderSettingsScreen.Error}>
        <Suspense fallback={<ReminderSettingsScreen.Loading />}>
          <SettingsListGroup label={t('settings.sections.times')}>
            <ReminderTimeInput
              label={t('settings.reminderMorningLabel')}
              description={t('settings.reminderMorningDescription')}
              period="morning"
            />
            <SettingsListGroup.Separator />
            <ReminderTimeInput
              label={t('settings.reminderEveningLabel')}
              description={t('settings.reminderEveningDescription')}
              period="evening"
            />
          </SettingsListGroup>
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

ReminderSettingsScreen.Loading = function Loading() {
  const { t } = useTranslation('notification');

  return (
    <SettingsListGroup label={t('settings.sections.times')}>
      <SettingsListGroup.Item.Loading descriptionLines={1} hasValue />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Item.Loading descriptionLines={1} hasValue />
    </SettingsListGroup>
  );
};

ReminderSettingsScreen.Error = SettingsListGroup.Error;

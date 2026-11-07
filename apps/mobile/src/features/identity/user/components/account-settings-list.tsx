import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup, Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { UserPolicy } from '../domains/user.model';
import { useGetMeQueryOptions } from '../queries/user.queries';

export function AccountSettingsList() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
    <SettingsListGroup>
      <SettingsListGroup.Item
        label={t('titles.editName')}
        value={
          <Text size="b2" shade={6}>
            {user.name}
          </Text>
        }
        onPress={() => push('/settings/edit-name')}
      />
      {UserPolicy.hasCredential(user) && (
        <>
          <SettingsListGroup.Separator />
          <SettingsListGroup.Item
            label={t('titles.changePassword')}
            onPress={() => push('/settings/change-password')}
          />
        </>
      )}
    </SettingsListGroup>
  );
}

AccountSettingsList.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.ItemSkeleton hasValue />
    </SettingsListGroup>
  );
};

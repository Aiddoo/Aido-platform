import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { KeyDuoIcon, NameDuoIcon, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import { UserPolicy } from '../domains/user.model';
import { useGetMeQueryOptions } from '../queries/user.queries';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

export function AccountSettingsList(props: SettingsSectionProps) {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item
        icon={<SettingsListGroup.Icon Icon={NameDuoIcon} />}
        label={t('titles.editName')}
        value={
          <SettingsListGroup.Value numberOfLines={1} className="max-w-40">
            {user.name}
          </SettingsListGroup.Value>
        }
        onPress={() => push('/settings/edit-name')}
      />
      {UserPolicy.hasCredential(user) && (
        <>
          <SettingsListGroup.Separator />
          <SettingsListGroup.Item
            icon={<SettingsListGroup.Icon Icon={KeyDuoIcon} />}
            label={t('titles.changePassword')}
            onPress={() => push('/settings/change-password')}
          />
        </>
      )}
    </SettingsListGroup>
  );
}

AccountSettingsList.Loading = function Loading(props: SettingsSectionProps) {
  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item.Loading hasValue />
    </SettingsListGroup>
  );
};

AccountSettingsList.Error = SettingsListGroup.Error;

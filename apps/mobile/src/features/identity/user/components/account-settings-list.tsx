import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup, Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import { UserPolicy } from '../domains/user.model';
import { useGetMeQueryOptions } from '../queries/user.queries';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 섹션 이름(`label`) 같은 바깥 구성은 화면이 원본 SettingsListGroup props로 넘긴다 */
export function AccountSettingsList(props: SettingsSectionProps) {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
    <SettingsListGroup {...props}>
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

AccountSettingsList.Loading = function Loading(props: SettingsSectionProps) {
  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Item.Loading hasValue />
    </SettingsListGroup>
  );
};

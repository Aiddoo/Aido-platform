import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTranslation } from '@src/shared/i18n';
import { BellDuoIcon, MoonDuoIcon, SettingsListGroup } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { PushPermissionPolicy } from '../../domains/push-permission.model';
import { useRequestPushPermissionMutationOptions } from '../../queries/push-permission.mutations';
import { useGetPushPermissionQueryOptions } from '../../queries/push-permission.queries';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 기기 알림이 꺼져 있으면 설정은 바꿀 수 있지만 알림이 닿지 않는다는 뜻으로 흐리게 둔다 */
export function PushDeliverySettings(props: SettingsSectionProps) {
  const { t } = useTranslation(['notification', 'auth']);
  const [{ data: preference }, { data: permission }] = useSuspenseQueries({
    queries: [useGetPreferenceQueryOptions(), useGetPushPermissionQueryOptions()],
  });
  const updateMutation = useMutation(useUpdatePreferenceMutationOptions());
  // 권한 창이 닫힐 때까지 pending이라 토글을 두 번 누를 수 없다
  const requestPermissionMutation = useMutation(useRequestPushPermissionMutationOptions());

  const isUpdating = updateMutation.isPending || requestPermissionMutation.isPending;

  const handlePushEnabledChange = (enabled: boolean) =>
    updateMutation.mutate(
      { pushEnabled: enabled },
      {
        onSuccess: () => {
          if (enabled) {
            requestPermissionMutation.mutate({ source: 'settings' });
          }
        },
      },
    );

  return (
    <SettingsListGroup
      {...props}
      className={cn(!PushPermissionPolicy.isPushDeliverable(permission) && 'opacity-50')}
    >
      <SettingsListGroup.Toggle
        icon={<SettingsListGroup.Icon Icon={BellDuoIcon} />}
        label={t('settings.pushLabel')}
        description={t('settings.pushDescription')}
        isSelected={preference.pushEnabled}
        onSelectedChange={handlePushEnabledChange}
        isDisabled={isUpdating}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle
        icon={<SettingsListGroup.Icon Icon={MoonDuoIcon} />}
        label={t('settings.nightPushLabel')}
        description={
          preference.pushEnabled
            ? t('settings.nightPushDescription')
            : t('auth:preference.enablePushFirst')
        }
        isSelected={preference.nightPushEnabled}
        onSelectedChange={(enabled) => updateMutation.mutate({ nightPushEnabled: enabled })}
        isDisabled={!preference.pushEnabled || isUpdating}
      />
    </SettingsListGroup>
  );
}

PushDeliverySettings.Loading = function Loading(props: SettingsSectionProps) {
  return (
    <SettingsListGroup {...props}>
      <SettingsListGroup.Toggle.Loading hasDescription />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle.Loading hasDescription />
    </SettingsListGroup>
  );
};

PushDeliverySettings.Error = SettingsListGroup.Error;

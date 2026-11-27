import { NIGHT_TIME_CONFIG } from '@aido/api/vocabulary';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatHourLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { BellDuoIcon, MoonDuoIcon, ReportDuoIcon, SettingsListGroup } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useRequestPushPermissionMutationOptions } from '../queries/push-permission.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

/** 기기 알림이 꺼져 있으면 설정은 바꿀 수 있지만 알림이 닿지 않는다는 뜻으로 흐리게 둔다 */
export function PushDeliverySettings(props: SettingsSectionProps) {
  const { t } = useTranslation(['notification', 'auth']);
  const dateFormatContext = useDateFormatContext();
  const [{ data: preference }, { data: permission }] = useSuspenseQueries({
    queries: [useGetPreferenceQueryOptions(), useGetPushPermissionQueryOptions()],
  });
  const updatePreference = useMutation(useUpdatePreferenceMutationOptions());
  // 권한 창이 닫힐 때까지 pending이라 토글을 두 번 누를 수 없다
  const requestPushPermission = useMutation(useRequestPushPermissionMutationOptions());

  const isUpdating = updatePreference.isPending || requestPushPermission.isPending;

  const handlePushEnabledChange = (enabled: boolean) =>
    updatePreference.mutate(
      { pushEnabled: enabled },
      {
        onSuccess: () => {
          if (enabled) {
            requestPushPermission.mutate({ source: 'settings' });
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
            ? t('settings.nightPushDescription', {
                start: formatHourLabel(
                  NIGHT_TIME_CONFIG.START_HOUR,
                  preference.timeFormat,
                  dateFormatContext,
                ),
                end: formatHourLabel(
                  NIGHT_TIME_CONFIG.END_HOUR,
                  preference.timeFormat,
                  dateFormatContext,
                ),
              })
            : t('auth:preference.enablePushFirst')
        }
        isSelected={preference.nightPushEnabled}
        onSelectedChange={(enabled) => updatePreference.mutate({ nightPushEnabled: enabled })}
        isDisabled={!preference.pushEnabled || isUpdating}
      />
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle
        icon={<SettingsListGroup.Icon Icon={ReportDuoIcon} />}
        label={t('settings.aiPushLabel')}
        description={
          preference.pushEnabled
            ? t('settings.aiPushDescription')
            : t('auth:preference.enablePushFirst')
        }
        isSelected={preference.aiPushEnabled}
        onSelectedChange={(enabled) => updatePreference.mutate({ aiPushEnabled: enabled })}
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
      <SettingsListGroup.Separator />
      <SettingsListGroup.Toggle.Loading hasDescription />
    </SettingsListGroup>
  );
};

PushDeliverySettings.Error = SettingsListGroup.Error;

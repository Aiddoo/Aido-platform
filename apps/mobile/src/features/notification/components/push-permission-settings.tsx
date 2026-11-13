import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup, Text } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { usePushPermissionAction } from '../hooks/use-push-permission-action';
import { useOpenPushSettingsMutationOptions } from '../queries/push-permission.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';

const SOURCE: PushPermissionPromptSource = 'settings';

/** 푸시 알림 화면 맨 위. 기기 알림이 꺼져 있으면 아래 토글이 소용없다는 것과 켜는 한 단계를 먼저 보여 준다 */
export function PushPermissionSettings() {
  const { t } = useTranslation('notification');
  const { data: permission } = useSuspenseQuery(useGetPushPermissionQueryOptions());
  const { runStep, isPending } = usePushPermissionAction({ source: SOURCE });
  // 허용한 뒤 기기 설정을 여는 것은 권한을 되찾는 단계가 아니라 source 없이 열어 추적하지 않는다
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());

  return (
    <SettingsListGroup>
      {match(PushPermissionPolicy.getDeviceStep(permission))
        .with(PUSH_PERMISSION_STEP.NONE, () => (
          <SettingsListGroup.Item
            label={t('permission.status.label')}
            value={
              <SettingsListGroup.Value testID="push-permission-status">
                {t('permission.status.granted')}
              </SettingsListGroup.Value>
            }
            onPress={() => openSettings.mutate({})}
            isDisabled={openSettings.isPending}
          />
        ))
        .with(PUSH_PERMISSION_STEP.ASK, PUSH_PERMISSION_STEP.REQUEST_SYSTEM, (step) => (
          <SettingsListGroup.Item
            label={t('permission.deviceOff.title')}
            description={t('permission.deviceOff.description')}
            value={
              <Text
                size="b3"
                weight="semibold"
                className="text-main"
                testID="push-permission-status"
              >
                {t('permission.continue')}
              </Text>
            }
            onPress={() => runStep(step)}
            isDisabled={isPending}
          />
        ))
        .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => (
          <SettingsListGroup.Item
            label={t('permission.deviceOff.title')}
            description={t('permission.deviceOff.description')}
            value={
              <Text
                size="b3"
                weight="semibold"
                className="text-main"
                testID="push-permission-status"
              >
                {t('permission.card.openSettings')}
              </Text>
            }
            onPress={() => runStep(PUSH_PERMISSION_STEP.OPEN_SETTINGS)}
            isDisabled={isPending}
          />
        ))
        .exhaustive()}
    </SettingsListGroup>
  );
}

PushPermissionSettings.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.Item.Loading hasValue />
    </SettingsListGroup>
  );
};

PushPermissionSettings.Error = SettingsListGroup.Error;

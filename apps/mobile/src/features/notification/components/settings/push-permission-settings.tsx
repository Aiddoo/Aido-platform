import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { SettingsListGroup, Text } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP } from '../../constants/notification.constants';
import type { PushPermissionPromptSource } from '../../constants/notification.events';
import { PushPermissionPolicy } from '../../domains/push-permission.model';
import {
  useOpenPushSettingsMutationOptions,
  useRequestPushPermissionMutationOptions,
} from '../../queries/push-permission.mutations';
import { useGetPushPermissionQueryOptions } from '../../queries/push-permission.queries';

const SOURCE: PushPermissionPromptSource = 'settings';

/** 푸시 알림 화면 맨 위. 기기 알림이 꺼져 있으면 아래 토글이 소용없다는 것과 켜는 한 단계를 먼저 보여 준다 */
export function PushPermissionSettings() {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const { data: permission } = useSuspenseQuery(useGetPushPermissionQueryOptions());
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());

  return (
    <SettingsListGroup>
      {/* 이 줄은 기기 권한만 보여 준다. 앱 안 알림 설정과 상관없이 다음 단계를 고르려고 켜진 것으로 넘긴다 */}
      {match(PushPermissionPolicy.getNextStep(permission, { pushEnabled: true }))
        .with(PUSH_PERMISSION_STEP.NONE, PUSH_PERMISSION_STEP.ENABLE_IN_APP, () => (
          <SettingsListGroup.Item
            label={t('permission.status.label')}
            value={
              <Text size="b3" shade={7} testID="push-permission-status">
                {t('permission.status.granted')}
              </Text>
            }
            onPress={() => openSettings.mutate()}
          />
        ))
        .with(PUSH_PERMISSION_STEP.ASK, PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () => (
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
            onPress={() =>
              requestPermission.mutate(undefined, {
                onSuccess: (next) =>
                  trackEvent('push_permission_requested', { source: SOURCE, status: next.status }),
              })
            }
            isDisabled={requestPermission.isPending}
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
            onPress={() =>
              openSettings.mutate(undefined, {
                onSuccess: () => trackEvent('push_permission_settings_opened', { source: SOURCE }),
              })
            }
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

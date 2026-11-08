import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import {
  useOpenPushSettingsMutationOptions,
  useRequestPushPermissionMutationOptions,
} from '../queries/notification.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';

const SOURCE: PushPermissionPromptSource = 'settings';

/** 알림 설정 화면 맨 위. 기기 알림이 꺼져 있으면 아래 토글이 소용없다는 것과 켜는 방법을 먼저 보여 준다 */
export function PushPermissionStatusRow() {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const { data: permission } = useSuspenseQuery(useGetPushPermissionQueryOptions());
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());

  if (PushPermissionPolicy.isPushDeliverable(permission)) {
    return (
      <VStack gap={2}>
        <Text size="b3" weight="medium">
          {t('permission.status.label')}
        </Text>
        <Text size="e1" shade={6} testID="push-permission-status">
          {t('permission.status.granted')}
        </Text>
      </VStack>
    );
  }

  const requestSystemDialog = () =>
    requestPermission.mutate(undefined, {
      onSuccess: (next) =>
        trackEvent('push_permission_requested', { source: SOURCE, status: next.status }),
    });

  // 이 줄은 기기 권한만 보여 준다. 앱 안 알림 설정과 상관없이 다음 단계를 고르려고 켜진 것으로 넘긴다
  const action = match(PushPermissionPolicy.getNextStep(permission, { pushEnabled: true }))
    .with(PUSH_PERMISSION_STEP.ASK, PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () => (
      <Button
        size="small"
        variant="weak"
        display="inline"
        isLoading={requestPermission.isPending}
        onPress={requestSystemDialog}
      >
        {t('permission.onboarding.allow')}
      </Button>
    ))
    .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => (
      <Button
        size="small"
        variant="weak"
        display="inline"
        onPress={() =>
          openSettings.mutate(undefined, {
            onSuccess: () => trackEvent('push_permission_settings_opened', { source: SOURCE }),
          })
        }
      >
        {t('permission.card.openSettings')}
      </Button>
    ))
    .with(PUSH_PERMISSION_STEP.ENABLE_IN_APP, PUSH_PERMISSION_STEP.NONE, () => null)
    .exhaustive();

  return (
    <HStack align="center" gap={12}>
      <VStack gap={2} flex={1}>
        <Text size="b3" weight="semibold" testID="push-permission-status">
          {t('permission.deviceOff.title')}
        </Text>
        <Text size="e1" shade={6}>
          {t('permission.deviceOff.description')}
        </Text>
      </VStack>
      <Box>{action}</Box>
    </HStack>
  );
}

PushPermissionStatusRow.Loading = function Loading() {
  return (
    <HStack align="center" gap={12}>
      <VStack gap={2} flex={1}>
        <TextSkeleton size="b3" className="w-24" />
        <TextSkeleton size="e1" className="w-16" />
      </VStack>
    </HStack>
  );
};

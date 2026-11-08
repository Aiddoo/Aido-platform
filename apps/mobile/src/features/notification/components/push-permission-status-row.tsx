import { PUSH_PERMISSION_STATUS } from '@aido/api/vocabulary';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { Box, Button, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import {
  useOpenPushSettingsMutationOptions,
  useRequestPushPermissionMutationOptions,
} from '../queries/notification.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';
import { PushPermissionDialog } from './push-permission-dialog';

/** 알림 설정 화면 맨 위에 이 기기의 OS 알림 권한과 바로 할 수 있는 행동을 항상 보여 준다 */
export function PushPermissionStatusRow() {
  const { t } = useTranslation('notification');
  const { trackEvent } = useTrack();
  const { data: permission } = useSuspenseQuery(useGetPushPermissionQueryOptions());
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const statusLabel = match(permission.status)
    .with(PUSH_PERMISSION_STATUS.GRANTED, () => t('permission.status.granted'))
    .with(PUSH_PERMISSION_STATUS.PROVISIONAL, () => t('permission.status.provisional'))
    .with(PUSH_PERMISSION_STATUS.DENIED, () => t('permission.status.denied'))
    .with(PUSH_PERMISSION_STATUS.NOT_DETERMINED, () => t('permission.status.notDetermined'))
    .exhaustive();

  const action = match(PushPermissionPolicy.getNextStep(permission, { pushEnabled: true }))
    .with(PUSH_PERMISSION_STEP.ASK, () => (
      <Button size="small" variant="weak" display="inline" onPress={() => setIsDialogOpen(true)}>
        {t('permission.card.continue')}
      </Button>
    ))
    .with(PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () => (
      <Button
        size="small"
        variant="weak"
        display="inline"
        isLoading={requestPermission.isPending}
        onPress={() =>
          requestPermission.mutate(undefined, {
            onSuccess: (next) =>
              trackEvent('push_permission_requested', { source: 'settings', status: next.status }),
          })
        }
      >
        {t('permission.card.continue')}
      </Button>
    ))
    .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => (
      <Button
        size="small"
        variant="weak"
        display="inline"
        onPress={() =>
          openSettings.mutate(undefined, {
            onSuccess: () => trackEvent('push_permission_settings_opened', { source: 'settings' }),
          })
        }
      >
        {t('permission.card.openSettings')}
      </Button>
    ))
    .with(PUSH_PERMISSION_STEP.ENABLE_IN_APP, PUSH_PERMISSION_STEP.NONE, () => null)
    .exhaustive();

  return (
    <Box>
      <HStack align="center" gap={12}>
        <VStack gap={2} flex={1}>
          <Text size="b3" weight="medium">
            {t('permission.status.label')}
          </Text>
          <Text size="e1" shade={6} testID="push-permission-status">
            {statusLabel}
          </Text>
        </VStack>
        {action}
      </HStack>
      <PushPermissionDialog
        source="settings"
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </Box>
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

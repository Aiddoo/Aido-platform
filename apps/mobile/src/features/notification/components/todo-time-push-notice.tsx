import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';

import { PUSH_ASK_MOMENT } from '../constants/notification.constants';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useOpenPushSettingsMutationOptions } from '../queries/push-permission.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';

interface TodoTimePushNoticeProps {
  /** 종일이 아니고 시각을 정했을 때만 알림이 간다 */
  isTimed: boolean;
}

/** 알림이 꺼진 채 시간을 정하면 저장은 막지 않고 알림이 가지 않는다는 것만 한 줄로 알린다 */
export function TodoTimePushNotice({ isTimed }: TodoTimePushNoticeProps) {
  const { t } = useTranslation('notification');
  // 권한을 아직 모르면 칩 줄이 밀리지 않게 그리지 않는다
  const { data: permission } = useQuery(useGetPushPermissionQueryOptions());
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());

  if (
    !isTimed ||
    permission == null ||
    PushPermissionPolicy.getAskMoment(permission, { surface: 'todo-time' }) !==
      PUSH_ASK_MOMENT.DENIED_NOTICE
  ) {
    return null;
  }

  return (
    <HStack gap={4} align="center" className="flex-wrap">
      <Text size="e1" shade={6}>
        {t('permission.todoTime.off')}
      </Text>
      <Text size="e1" shade={5}>
        ·
      </Text>
      <TextButton
        size="small"
        variant="underline"
        onPress={() => openSettings.mutate({ source: 'todo_time' })}
      >
        {t('permission.card.openSettings')}
      </TextButton>
    </HStack>
  );
}

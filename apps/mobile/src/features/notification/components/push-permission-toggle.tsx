import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { SettingsListGroup } from '@src/shared/ui';
import { useMutation, useSuspenseQueries } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import {
  useOpenPushSettingsMutationOptions,
  useRequestPushPermissionMutationOptions,
  useUpdatePushEnabledAndAskPermissionMutationOptions,
} from '../queries/push-permission.mutations';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';

type PushPermissionToggleProps = Omit<
  ComponentProps<typeof SettingsListGroup.Toggle>,
  'isSelected' | 'onSelectedChange' | 'description'
> & {
  source: PushPermissionPromptSource;
  /** 받을 수 있을 때와 아직 못 받을 때의 설명. 토글이 어느 쪽인지 정한다 */
  descriptions: Record<'on' | 'off', string>;
};

/**
 * 푸시를 받을 수 있게 켜는 토글. 지금 상태에서 필요한 한 단계(권한 묻기·기기 설정·앱 알림 켜기)를 고른다.
 * 끄기는 알림 설정 한 곳에서만 해서, 받을 수 있으면 켜진 채 잠긴다
 */
export function PushPermissionToggle({
  source,
  descriptions,
  isDisabled,
  ...props
}: PushPermissionToggleProps) {
  const [{ data: permission }, { data: preference }] = useSuspenseQueries({
    queries: [useGetPushPermissionQueryOptions(), useGetPreferenceQueryOptions()],
  });
  const nextStep = PushPermissionPolicy.getNextStep(permission, {
    pushEnabled: preference.pushEnabled,
  });
  const enablePush = useEnablePush(source);
  const isReceivable = nextStep === PUSH_PERMISSION_STEP.NONE;

  return (
    <SettingsListGroup.Toggle
      description={isReceivable ? descriptions.on : descriptions.off}
      isSelected={isReceivable}
      isDisabled={isDisabled === true || isReceivable || enablePush.isPending}
      onSelectedChange={() => enablePush.mutate(nextStep)}
      {...props}
    />
  );
}

type PushPermissionStep = ReturnType<typeof PushPermissionPolicy.getNextStep>;

/** 다음 단계에 맞는 기존 동작을 고른다. 셋 다 권한·설정 캐시를 스스로 맞춘다 */
function useEnablePush(source: PushPermissionPromptSource) {
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());
  const enableInApp = useMutation(useUpdatePushEnabledAndAskPermissionMutationOptions());

  const mutate = (step: PushPermissionStep) =>
    match(step)
      .with(PUSH_PERMISSION_STEP.ASK, PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () =>
        requestPermission.mutate({ source }),
      )
      .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => openSettings.mutate({ source }))
      .with(PUSH_PERMISSION_STEP.ENABLE_IN_APP, () => enableInApp.mutate({ pushEnabled: true }))
      .with(PUSH_PERMISSION_STEP.NONE, () => undefined)
      .exhaustive();

  return {
    mutate,
    isPending: requestPermission.isPending || openSettings.isPending || enableInApp.isPending,
  };
}

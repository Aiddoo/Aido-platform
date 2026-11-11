import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { match } from 'ts-pattern';

import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import type { PushPermissionStep } from '../domains/push-permission.model';
import {
  useOpenPushSettingsMutationOptions,
  useRequestPushPermissionMutationOptions,
  useUpdatePushEnabledAndAskPermissionMutationOptions,
} from '../queries/push-permission.mutations';

interface UsePushPermissionActionOptions {
  source: PushPermissionPromptSource;
}

interface RunStepOptions {
  /** 시스템 창·설정을 열지 못했을 때. 사용자 안내는 mutation이 이미 했다 */
  onError?: () => void;
}

/** 알림을 받으려면 필요한 한 단계(권한 묻기·기기 설정·앱 알림 켜기)를 실행한다. 결과는 mutation이 한 번 추적한다 */
export function usePushPermissionAction({ source }: UsePushPermissionActionOptions) {
  const requestPermission = useMutation(useRequestPushPermissionMutationOptions());
  const openSettings = useMutation(useOpenPushSettingsMutationOptions());
  const enableInApp = useMutation(useUpdatePushEnabledAndAskPermissionMutationOptions());

  const runStep = (step: PushPermissionStep, { onError }: RunStepOptions = {}) =>
    match(step)
      .with(PUSH_PERMISSION_STEP.ASK, PUSH_PERMISSION_STEP.REQUEST_SYSTEM, () =>
        requestPermission.mutate({ source }, { onError }),
      )
      .with(PUSH_PERMISSION_STEP.OPEN_SETTINGS, () => openSettings.mutate({ source }, { onError }))
      // 기기는 이미 허용이라 권한 창이 뜨지 않는다. 앱 알림을 켠 것은 설정 변경(settings_changed)으로 남는다
      .with(PUSH_PERMISSION_STEP.ENABLE_IN_APP, () =>
        enableInApp.mutate({ pushEnabled: true }, { onError }),
      )
      .with(PUSH_PERMISSION_STEP.NONE, noop)
      .exhaustive();

  const isPending = requestPermission.isPending || openSettings.isPending || enableInApp.isPending;

  return { runStep, isPending };
}

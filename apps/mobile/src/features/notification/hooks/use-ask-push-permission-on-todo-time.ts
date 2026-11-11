import { useLogger } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { PUSH_ASK_MOMENT, PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';
import { usePushPermissionAction } from './use-push-permission-action';

const SOURCE: PushPermissionPromptSource = 'todo_time';

/** 할 일 시간을 정한 순간 아직 묻지 않았으면 그 자리에서 시스템 창을 띄운다. 거절 상태는 칩 아래 한 줄이 맡는다 */
export function useAskPushPermissionOnTodoTime() {
  const queryClient = useQueryClient();
  const permissionQueryOptions = useGetPushPermissionQueryOptions();
  const { runStep } = usePushPermissionAction({ source: SOURCE });
  const { trackEvent } = useTrack();
  const logger = useLogger();

  const askIfUndetermined = async () => {
    // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
    const permission = await queryClient.ensureQueryData(permissionQueryOptions);
    if (
      PushPermissionPolicy.getAskMoment(permission, { surface: 'todo-time' }) !==
      PUSH_ASK_MOMENT.SYSTEM_DIALOG
    ) {
      return;
    }
    trackEvent('push_permission_prompt_shown', {
      source: SOURCE,
      step: PUSH_PERMISSION_STEP.REQUEST_SYSTEM,
    });
    runStep(PUSH_PERMISSION_STEP.REQUEST_SYSTEM);
  };

  // 저장을 막지 않는다. 권한을 읽지 못해도 시간은 그대로 남는다
  return () => {
    askIfUndetermined().catch((error: unknown) =>
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUEST_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };
}

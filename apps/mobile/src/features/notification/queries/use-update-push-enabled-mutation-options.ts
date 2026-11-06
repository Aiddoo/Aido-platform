import {
  useActivationService,
  useLogger,
  usePushDeviceService,
} from '@src/bootstrap/providers/di-context';
import { unlockPushRegistrationForActivation } from '@src/features/device/activation/queries/activation-cache';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/use-update-preference-mutation-options';
import { getErrorMessage } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { PushPermission } from '../domains/push-permission.model';

/**
 * 앱 푸시 설정을 바꾸고, 켰을 때는 이어서 OS 권한을 묻는다.
 * 권한 창이 닫힐 때까지 pending이라 토글을 두 번 누를 수 없다.
 */
export const useUpdatePushEnabledMutationOptions = () => {
  const updatePreferenceOptions = useUpdatePreferenceMutationOptions();
  const pushDeviceService = usePushDeviceService();
  const activationService = useActivationService();
  const logger = useLogger();
  const queryClient = useQueryClient();

  return mutationOptions({
    ...updatePreferenceOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await updatePreferenceOptions.onSuccess?.(data, variables, onMutateResult, context);
      if (variables.pushEnabled !== true) {
        return;
      }
      // 아직 활성화 전인 신규 사용자는 여기서 요청 시점이 열리고, 자동 요청 훅이 이어서 묻는다
      if (unlockPushRegistrationForActivation({ queryClient, service: activationService })) {
        return;
      }
      await pushDeviceService.requestPermission().then(
        (permission) => {
          queryClient.setQueryData<PushPermission>(
            NOTIFICATION_QUERY_KEYS.permission(),
            permission,
          );
        },
        (error: unknown) => {
          logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUEST_FAILED, {
            error: getErrorMessage(error),
          });
        },
      );
    },
  });
};

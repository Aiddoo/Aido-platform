import {
  useActivationService,
  useHaptics,
  useLogger,
  usePushDeviceService,
} from '@src/bootstrap/providers/di-context';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { NOTIFICATION_LOG_EVENT } from '@src/features/notification/constants/notification-log-events';
import { setCachedPushPermission } from '@src/features/notification/queries/notification-cache';
import { getNowInstant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { getCachedActivationContext, invalidateActivationProgress } from './activation-cache';

/**
 * 앱 푸시 설정을 바꾸고, 켰을 때는 이어서 OS 권한을 묻는다.
 * 권한 창이 닫힐 때까지 pending이라 토글을 두 번 누를 수 없다.
 */
export function useUpdatePushEnabledAndAskPermissionMutationOptions() {
  const updatePreferenceOptions = useUpdatePreferenceMutationOptions();
  const pushDeviceService = usePushDeviceService();
  const activationService = useActivationService();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    ...updatePreferenceOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await updatePreferenceOptions.onSuccess?.(data, variables, onMutateResult, context);
      if (variables.pushEnabled !== true) {
        return;
      }
      // 아직 활성화 전인 신규 사용자는 여기서 요청 시점이 열리고, 자동 요청 훅이 이어서 묻는다
      const unlocked = activationService.unlockPushRegistration({
        ...getCachedActivationContext(queryClient),
        now: getNowInstant(),
      });
      invalidateActivationProgress(queryClient);
      if (unlocked?.didOpenAskMoment === true) {
        return;
      }
      await pushDeviceService.requestPermission().then(
        (permission) => {
          setCachedPushPermission(queryClient, permission);
        },
        (error: unknown) => {
          logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUEST_FAILED, {
            error: getErrorMessage(error),
          });
          haptics.notify('error');
          toast.error(t('notification:permission.toasts.requestFailed'));
        },
      );
    },
  });
}

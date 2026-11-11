import {
  useExternalLink,
  useHaptics,
  useLogger,
  usePushRegistrationService,
} from '@src/bootstrap/providers/di-context';
import { useUpdatePreferenceMutationOptions } from '@src/features/identity/preference/queries/preference.mutations';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { setCachedPushPermission } from './push-permission-cache';

interface PushPermissionActionVariables {
  /** 권한을 묻거나 설정을 연 UI. 결과를 추적할 때만 쓴다 */
  source: PushPermissionPromptSource;
}

interface OpenPushSettingsVariables {
  /** 권한을 되찾으려고 연 UI. 허용한 뒤 기기 설정을 여는 길은 권한 단계가 아니라 비워 두고 추적하지 않는다 */
  source?: PushPermissionPromptSource;
}

/** 알림을 거절해 시스템 창을 다시 띄울 수 없을 때 이 앱의 설정 화면을 연다. 돌아오면 권한 쿼리가 다시 읽는다 */
export function useOpenPushSettingsMutationOptions() {
  const externalLink = useExternalLink();
  const logger = useLogger();
  const haptics = useHaptics();
  const toast = useAppToast();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: (_variables: OpenPushSettingsVariables) => externalLink.openSettings(),
    networkMode: 'always',
    onSuccess: (_opened, { source }) => {
      if (source != null) {
        trackEvent('push_permission_settings_opened', { source });
      }
    },
    onError: (error) => {
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_SETTINGS_OPEN_FAILED, {
        error: getErrorMessage(error),
      });
      haptics.notify('error');
      toast.error(t('notification:permission.toasts.settingsOpenFailed'));
    },
    meta: { errorFeedback: false },
  });
}

export function useRequestPushPermissionMutationOptions() {
  const pushRegistrationService = usePushRegistrationService();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: (_variables: PushPermissionActionVariables) =>
      pushRegistrationService.requestPermission(),
    // 권한 창은 기기 안에서 뜨므로 오프라인에서도 멈추지 않는다
    networkMode: 'always',
    onSuccess: (permission, { source }) => {
      setCachedPushPermission(queryClient, permission);
      trackEvent('push_permission_requested', { source, status: permission.status });
    },
    onError: (error) => {
      logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_REQUEST_FAILED, {
        error: getErrorMessage(error),
      });
      haptics.notify('error');
      toast.error(t('notification:permission.toasts.requestFailed'));
    },
    meta: { errorFeedback: false },
  });
}

// 권한 창이 닫힐 때까지 pending이라 토글을 두 번 누를 수 없다
export function useUpdatePushEnabledAndAskPermissionMutationOptions() {
  const updatePreferenceOptions = useUpdatePreferenceMutationOptions();
  const pushRegistrationService = usePushRegistrationService();
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
      await pushRegistrationService.requestPermission().then(
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

import { useExternalLink, usePushRegistrationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { PushPermissionPromptSource } from '../constants/notification.events';
import { setCachedPushPermission } from './push-permission-cache';

interface RequestPushPermissionVariables {
  /** 권한을 물은 UI. 앱 알림을 켠 뒤 이미 허용한 기기를 다시 읽는 길은 비워 두고 추적하지 않는다 */
  source?: PushPermissionPromptSource;
}

interface OpenPushSettingsVariables {
  /** 권한을 되찾으려고 연 UI. 허용한 뒤 기기 설정을 여는 길은 권한 단계가 아니라 비워 두고 추적하지 않는다 */
  source?: PushPermissionPromptSource;
}

/** 알림을 거절해 시스템 창을 다시 띄울 수 없을 때 이 앱의 설정 화면을 연다. 돌아오면 권한 쿼리가 다시 읽는다 */
export function useOpenPushSettingsMutationOptions() {
  const externalLink = useExternalLink();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: (_variables: OpenPushSettingsVariables) => externalLink.openSettings(),
    networkMode: 'always',
    onSuccess: (_opened, { source }) => {
      if (source != null) {
        trackEvent('push_permission_settings_opened', { source });
      }
    },
    meta: {
      errorFeedback: {
        feature: 'notification',
        fallbackKey: 'notification:permission.toasts.settingsOpenFailed',
      },
    },
  });
}

export function useRequestPushPermissionMutationOptions() {
  const pushRegistrationService = usePushRegistrationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationFn: (_variables: RequestPushPermissionVariables) =>
      pushRegistrationService.requestPermission(),
    // 권한 창은 기기 안에서 뜨므로 오프라인에서도 멈추지 않는다
    networkMode: 'always',
    onSuccess: (permission, { source }) => {
      setCachedPushPermission(queryClient, permission);
      if (source != null) {
        trackEvent('push_permission_requested', { source, status: permission.status });
      }
    },
    meta: {
      errorFeedback: {
        feature: 'notification',
        fallbackKey: 'notification:permission.toasts.requestFailed',
      },
    },
  });
}

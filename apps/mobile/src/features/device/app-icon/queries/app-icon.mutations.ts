import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { AppIconKey } from '../domains/app-icon.model';
import { cancelAppIcon, setAppIconInCache } from './app-icon-cache';

export function useChangeAppIconMutationOptions() {
  const appIconService = useAppIconService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: (key: AppIconKey) => appIconService.changeIcon(key),
    onMutate: () => cancelAppIcon(queryClient),
    onSuccess: (key) => {
      setAppIconInCache(queryClient, key);
      // 고른 값이 아니라 OS가 확정한 아이콘을 남긴다
      trackEvent('settings_changed', { setting: 'app_icon', value: key });
    },
    meta: {
      errorFeedback: { feature: 'app_icon', fallbackKey: 'appIcon:errorDialog.description' },
    },
  });
}

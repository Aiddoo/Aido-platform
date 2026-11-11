import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { AppIconKey } from '../domains/app-icon.model';
import { APP_ICON_QUERY_KEYS } from './app-icon-query-keys';

export function useChangeAppIconMutationOptions() {
  const appIconService = useAppIconService();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: (key: AppIconKey) => appIconService.changeIcon(key),
    onMutate: () => queryClient.cancelQueries({ queryKey: APP_ICON_QUERY_KEYS.current() }),
    onSuccess: (key) => {
      queryClient.setQueryData(APP_ICON_QUERY_KEYS.current(), key);
    },
    meta: {
      errorFeedback: { feature: 'app_icon', fallbackKey: 'appIcon:errorDialog.description' },
    },
  });
}

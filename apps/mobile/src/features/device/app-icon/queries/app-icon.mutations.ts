import { useAppIconService, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from '../constants/app-icon-query-keys';
import type { AppIconKey } from '../schemas/app-icon.schema';

export function useChangeAppIconMutationOptions() {
  const service = useAppIconService();
  const queryClient = useQueryClient();
  const errorReporter = useErrorReporter();

  return mutationOptions({
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: (key: AppIconKey) => service.changeIcon(key),
    onMutate: () => queryClient.cancelQueries({ queryKey: APP_ICON_QUERY_KEYS.current() }),
    onSuccess: (key) => {
      queryClient.setQueryData(APP_ICON_QUERY_KEYS.current(), key);
    },
    onError: (error) => {
      errorReporter.captureException(toError(error), { feature: 'app_icon' });
    },
  });
}

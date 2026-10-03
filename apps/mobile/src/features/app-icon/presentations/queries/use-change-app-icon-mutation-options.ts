import { useAppIconService, useErrorReporter } from '@src/bootstrap/providers/di-context';
import type { AppIconKey } from '@src/features/app-icon/models/app-icon.model';
import { toError } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from '../constants/app-icon-query-keys.constant';

export function useChangeAppIconMutationOptions() {
  const service = useAppIconService();
  const queryClient = useQueryClient();
  const errorReporter = useErrorReporter();

  return mutationOptions({
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

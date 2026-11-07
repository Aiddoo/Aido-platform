import { useAppIconService, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from '../constants/app-icon-query-keys';
import type { AppIconKey } from '../schemas/app-icon.schema';

export function useChangeAppIconMutationOptions() {
  const appIconService = useAppIconService();
  const queryClient = useQueryClient();
  const errorReporter = useErrorReporter();
  const showFailure = useMutationFailure(t('appIcon:errorDialog.description'));

  return mutationOptions({
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: (key: AppIconKey) => appIconService.changeIcon(key),
    onMutate: () => queryClient.cancelQueries({ queryKey: APP_ICON_QUERY_KEYS.current() }),
    onSuccess: (key) => {
      queryClient.setQueryData(APP_ICON_QUERY_KEYS.current(), key);
    },
    onError: (error) => {
      errorReporter.captureException(toError(error), { feature: 'app_icon' });
      showFailure(error);
    },
  });
}

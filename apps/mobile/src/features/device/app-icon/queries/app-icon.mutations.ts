import { useAppIconService, useHaptics } from '@src/bootstrap/providers/di-context';
import { getUserFacingMessage } from '@src/shared/errors';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { APP_ICON_QUERY_KEYS } from '../constants/app-icon-query-keys';
import type { AppIconKey } from '../domains/app-icon.model';

export function useChangeAppIconMutationOptions() {
  const appIconService = useAppIconService();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();
  const reportUnexpectedError = useReportUnexpectedError('app_icon');

  return mutationOptions({
    // 기기 안에서만 처리해 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: (key: AppIconKey) => appIconService.changeIcon(key),
    onMutate: () => queryClient.cancelQueries({ queryKey: APP_ICON_QUERY_KEYS.current() }),
    onSuccess: (key) => {
      queryClient.setQueryData(APP_ICON_QUERY_KEYS.current(), key);
    },
    onError: (error) => {
      reportUnexpectedError(error);
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('appIcon:errorDialog.description') });
    },
  });
}

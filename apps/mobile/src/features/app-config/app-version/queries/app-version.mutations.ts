import { useAppStoreListing, useErrorReporter } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';

export function useOpenStoreListingMutationOptions() {
  const appStoreListing = useAppStoreListing();
  const errorReporter = useErrorReporter();
  const showFailure = useMutationFailure(t('appVersion:storeOpenFailed'));

  return mutationOptions({
    // 기기가 스토어를 여는 일이라 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: () => appStoreListing.openListing(),
    onError: (error) => {
      errorReporter.captureException(toError(error), { feature: 'app_version' });
      showFailure(error);
    },
  });
}

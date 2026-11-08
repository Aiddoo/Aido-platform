import { useAppStoreListing, useHaptics } from '@src/bootstrap/providers/di-context';
import { getUserFacingMessage } from '@src/shared/errors';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions } from '@tanstack/react-query';

export function useOpenStoreListingMutationOptions() {
  const appStoreListing = useAppStoreListing();
  const reportUnexpectedError = useReportUnexpectedError('app_version');
  const haptics = useHaptics();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: () => appStoreListing.openListing(),
    onError: (error) => {
      reportUnexpectedError(error);
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('appVersion:storeOpenFailed') });
    },
  });
}

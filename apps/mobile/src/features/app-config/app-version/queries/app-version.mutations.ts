import { useAppStoreListing } from '@src/bootstrap/providers/di-context';
import { mutationOptions } from '@tanstack/react-query';

import { APP_VERSION_MUTATION_KEYS } from './app-version-mutation-keys';

export function useOpenStoreListingMutationOptions() {
  const appStoreListing = useAppStoreListing();

  return mutationOptions({
    mutationKey: APP_VERSION_MUTATION_KEYS.openStoreListing(),
    // 기기가 스토어를 여는 일이라 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: () => appStoreListing.openListing(),
    meta: { errorFeedback: { feature: 'app_version', fallbackKey: 'appVersion:storeOpenFailed' } },
  });
}

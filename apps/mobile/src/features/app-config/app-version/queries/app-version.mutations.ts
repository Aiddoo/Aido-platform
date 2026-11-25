import { useAppStoreListing } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import type { AnalyticsSource } from '@src/shared/analytics/event-vocabulary';
import { mutationOptions } from '@tanstack/react-query';

import { APP_VERSION_MUTATION_KEYS } from './app-version-mutation-keys';

interface OpenStoreListingVariables {
  source: AnalyticsSource<'settings'>;
}

export function useOpenStoreListingMutationOptions() {
  const appStoreListing = useAppStoreListing();
  const { trackEvent } = useTrack();

  return mutationOptions({
    mutationKey: APP_VERSION_MUTATION_KEYS.openStoreListing(),
    // 기기가 스토어를 여는 일이라 연결 상태와 무관하다
    networkMode: 'always',
    mutationFn: (_variables: OpenStoreListingVariables) => appStoreListing.openListing(),
    // 스토어가 열리는 사이 설정 화면이 내려가도 연 것은 남긴다
    onSuccess: (_result, { source }) => {
      trackEvent('app_update_store_opened', { source });
    },
    meta: { errorFeedback: { feature: 'app_version', fallbackKey: 'appVersion:storeOpenFailed' } },
  });
}

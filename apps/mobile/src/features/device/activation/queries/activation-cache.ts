import { getCachedFeatureCampaignConfig } from '@src/features/app-config/feature-campaign/queries/feature-campaign-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import type { QueryClient } from '@tanstack/react-query';

import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';

/** 활성화 진행을 기록할 때 쓰는 캠페인 설정과 내 계정. 아직 받지 않았으면 비어 있고 Service가 기록하지 않는다 */
export function getCachedActivationContext(queryClient: QueryClient) {
  return {
    config: getCachedFeatureCampaignConfig(queryClient),
    user: getCachedMe(queryClient),
  };
}

/** 진행 값의 원천은 기기 저장소다. 기록한 뒤 조회가 그 값을 다시 읽게 한다 */
export function invalidateActivationProgress(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ACTIVATION_QUERY_KEYS.all });
}

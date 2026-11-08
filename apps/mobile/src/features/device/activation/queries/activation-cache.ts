import { getCachedFeatureCampaignConfig } from '@src/features/app-config/feature-campaign/queries/feature-campaign-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import type { QueryClient } from '@tanstack/react-query';

/** 활성화 진행을 기록할 때 쓰는 캠페인 설정과 내 계정. 아직 받지 않았으면 비어 있고 Service가 기록하지 않는다 */
export function getCachedActivationContext(queryClient: QueryClient) {
  return {
    config: getCachedFeatureCampaignConfig(queryClient),
    user: getCachedMe(queryClient),
  };
}

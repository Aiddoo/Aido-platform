import type { CampaignId, FeatureKey } from '@src/shared/analytics/feature-key';

import type { ReleaseId } from '../domains/whats-new.model';
import type { WhatsNewSource } from '../schemas/whats-new-params.schema';
import type { RELEASE_1_15_0_STEPS } from './release-1-15-0.constants';

/** 소개 단계 이름. 목록 줄에서 바로 해 보기는 list다 */
export type WhatsNewStep = (typeof RELEASE_1_15_0_STEPS)[number] | 'list';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 캠페인·기능·진입점만 담는다. 계정 id와 사용자 글은 넣지 않는다 */
    feature_hub_impression: { campaign_id: CampaignId; source: WhatsNewSource };
    feature_hub_dismissed: { campaign_id: CampaignId; source: WhatsNewSource };
    feature_card_cta: { campaign_id: CampaignId; feature: FeatureKey; source: WhatsNewSource };
    /** 흐름 한 번에 단계마다 한 번. 뒤로 갔다 돌아와도 다시 세지 않는다 */
    whats_new_step_viewed: {
      release_id: ReleaseId;
      step: WhatsNewStep;
      index: number;
      source: WhatsNewSource;
    };
    whats_new_completed: { release_id: ReleaseId; source: WhatsNewSource };
    whats_new_cta_pressed: { release_id: ReleaseId; step: WhatsNewStep };
  }
}

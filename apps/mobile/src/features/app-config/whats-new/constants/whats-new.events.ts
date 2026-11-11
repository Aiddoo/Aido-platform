import type { FeatureKey } from '@src/shared/analytics/feature-key';

import type { ReleaseId } from '../domains/whats-new.model';
import type { WhatsNewSource } from '../schemas/whats-new-params.schema';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 캠페인·기능·진입점만 담는다. 계정 id와 사용자 글은 넣지 않는다 */
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    feature_hub_impression: { campaign_id: string; source: WhatsNewSource };
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    feature_hub_dismissed: { campaign_id: string; source: WhatsNewSource };
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    feature_card_cta: { campaign_id: string; feature: FeatureKey; source: WhatsNewSource };
    /** 흐름 한 번에 단계마다 한 번. 뒤로 갔다 돌아와도 다시 세지 않는다 */
    whats_new_step_viewed: {
      release_id: ReleaseId;
      // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
      step: string;
      index: number;
      source: WhatsNewSource;
    };
    whats_new_completed: { release_id: ReleaseId; source: WhatsNewSource };
    // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
    whats_new_cta_pressed: { release_id: ReleaseId; step: string };
  }
}

import type { Analytics } from '@src/core/ports/analytics';
import type { FeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { track } from '@src/shared/analytics/track';
import { getErrorMessage } from '@src/shared/errors';
import { logger } from '@src/shared/infra/logger/global-logger';
import type { FeatureHubSource, FeatureKey } from '@src/shared/observability/telemetry-keys';

import { WHATS_NEW_LOG_EVENT } from '../constants/whats-new-log-events';
import type { WhatsNewCardId } from '../domains/whats-new.registry';

const CARD_FEATURE_KEYS = {
  friend_invite: 'friend_invite',
  voice_say: 'voice_quick',
  voice_plan: 'voice_quick',
  voice_facts: 'voice_quick',
} as const satisfies Record<WhatsNewCardId, FeatureKey>;

interface WhatsNewHubEventInput {
  campaignId: string;
  source: FeatureHubSource;
}

interface WhatsNewCardCtaInput extends WhatsNewHubEventInput {
  accountId: string | undefined;
  cardId: WhatsNewCardId;
}

function recordBestEffort(record: () => void): void {
  try {
    record();
  } catch (error) {
    // 분석은 사용자 흐름보다 우선하지 않는다. 동기 어댑터 실패도 화면 동작에서 격리한다.
    logger.warn(WHATS_NEW_LOG_EVENT.ANALYTICS_RECORD_FAILED, {
      error: getErrorMessage(error),
    });
  }
}

export function recordWhatsNewImpression(
  analytics: Analytics,
  { campaignId, source }: WhatsNewHubEventInput,
): void {
  recordBestEffort(() => {
    track(analytics, 'feature_hub_impression', {
      campaign_id: campaignId,
      source,
    });
  });
}

export function recordWhatsNewDismissed(
  analytics: Analytics,
  { campaignId, source }: WhatsNewHubEventInput,
): void {
  recordBestEffort(() => {
    track(analytics, 'feature_hub_dismissed', {
      campaign_id: campaignId,
      source,
    });
  });
}

export function recordWhatsNewCardCta(
  analytics: Analytics,
  attribution: FeatureAttributionStore,
  { accountId, campaignId, cardId, source }: WhatsNewCardCtaInput,
): void {
  const feature = CARD_FEATURE_KEYS[cardId];
  recordBestEffort(() => {
    track(analytics, 'feature_card_cta', {
      campaign_id: campaignId,
      feature,
      source,
    });
  });
  if (accountId) {
    recordBestEffort(() => {
      attribution.record({ accountId, campaignId, feature });
    });
  }
}

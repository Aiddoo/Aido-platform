import type { Analytics } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { DAY_MS } from '@src/shared/constants/time-units';
import { getErrorMessage } from '@src/shared/errors';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';
import { z } from 'zod';

import { FEATURE_ATTRIBUTION_LOG_EVENT } from './feature-attribution-log-events';
import { type CampaignId, FEATURE_KEYS, type FeatureKey } from './feature-key';
import { track } from './track';

export const FEATURE_ATTRIBUTION_TTL_MS = 7 * DAY_MS;
// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const KEY_PREFIX = 'aido_feature_attribution_v1';

const persistedAttributionSchema = z.object({
  campaignId: z.string().min(1),
  feature: z.enum(FEATURE_KEYS),
  expiresAt: z.number().int().positive(),
});

interface RecordAttributionInput {
  accountId: string;
  campaignId: CampaignId;
  feature: FeatureKey;
}

interface ConsumeAttributionInput {
  accountId: string;
  feature: FeatureKey;
}

interface ConsumedFeatureAttribution {
  campaignId: CampaignId;
  feature: FeatureKey;
}

export interface FeatureAttributionStore {
  record(input: RecordAttributionInput): void;
  consume(input: ConsumeAttributionInput): ConsumedFeatureAttribution | null;
}

function getAttributionKey(accountId: string, feature: FeatureKey): string {
  return `${KEY_PREFIX}:${accountId}:${feature}`;
}

export function createFeatureAttributionStore(
  storage: SyncStorage,
  now: () => number = Date.now,
): FeatureAttributionStore {
  return {
    record({ accountId, campaignId, feature }) {
      storage.set(
        getAttributionKey(accountId, feature),
        JSON.stringify({
          campaignId,
          feature,
          expiresAt: now() + FEATURE_ATTRIBUTION_TTL_MS,
        }),
      );
    },

    consume({ accountId, feature }) {
      const key = getAttributionKey(accountId, feature);
      const raw = storage.get(key);
      if (!raw) {
        return null;
      }

      // 재진입해도 한 번만 집계되도록 반환보다 삭제가 먼저다
      storage.remove(key);

      const persisted = parseStoredJson(raw, persistedAttributionSchema);
      if (persisted == null || persisted.feature !== feature || persisted.expiresAt < now()) {
        return null;
      }

      return {
        campaignId: persisted.campaignId,
        feature: persisted.feature,
      };
    },
  };
}

interface AttributedFeatureSuccessPorts {
  analytics: Analytics;
  attribution: FeatureAttributionStore;
  logger: Pick<Logger, 'warn'>;
}

export function trackAttributedFeatureSuccess(
  { analytics, attribution, logger }: AttributedFeatureSuccessPorts,
  input: ConsumeAttributionInput,
): void {
  try {
    const consumed = attribution.consume(input);
    if (!consumed) {
      return;
    }

    track(analytics, 'feature_action_success', {
      campaign_id: consumed.campaignId,
      feature: consumed.feature,
    });
  } catch (error) {
    // 분석·귀속은 best-effort라 사용자 흐름을 중단시키지 않는다
    logger.warn(FEATURE_ATTRIBUTION_LOG_EVENT.SUCCESS_TRACK_FAILED, {
      error: getErrorMessage(error),
    });
  }
}

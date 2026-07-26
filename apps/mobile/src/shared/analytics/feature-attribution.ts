import type { Analytics } from '@src/core/ports/analytics';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { z } from 'zod';
import { FEATURE_KEYS, type FeatureKey } from './events/growth.events';

const DAY_MS = 24 * 60 * 60 * 1000;
export const FEATURE_ATTRIBUTION_TTL_MS = 7 * DAY_MS;
const KEY_PREFIX = 'aido_feature_attribution_v1';

const persistedAttributionSchema = z.object({
  campaignId: z.string().min(1),
  feature: z.enum(FEATURE_KEYS),
  expiresAt: z.number().int().positive(),
});

interface RecordAttributionInput {
  accountId: string;
  campaignId: string;
  feature: FeatureKey;
}

interface ConsumeAttributionInput {
  accountId: string;
  feature: FeatureKey;
}

export interface ConsumedFeatureAttribution {
  campaignId: string;
  feature: FeatureKey;
}

export interface FeatureAttributionStore {
  record(input: RecordAttributionInput): void;
  consume(input: ConsumeAttributionInput): ConsumedFeatureAttribution | null;
}

const attributionKey = (accountId: string, feature: FeatureKey): string =>
  `${KEY_PREFIX}:${accountId}:${feature}`;

export function createFeatureAttributionStore(
  storage: SyncStorage,
  now: () => number = Date.now,
): FeatureAttributionStore {
  return {
    record({ accountId, campaignId, feature }) {
      storage.set(
        attributionKey(accountId, feature),
        JSON.stringify({
          campaignId,
          feature,
          expiresAt: now() + FEATURE_ATTRIBUTION_TTL_MS,
        }),
      );
    },

    consume({ accountId, feature }) {
      const key = attributionKey(accountId, feature);
      const raw = storage.getString(key);
      if (!raw) {
        return null;
      }

      let decoded: unknown;
      try {
        decoded = JSON.parse(raw);
      } catch {
        storage.delete(key);
        return null;
      }

      const parsed = persistedAttributionSchema.safeParse(decoded);
      if (!parsed.success || parsed.data.feature !== feature || parsed.data.expiresAt < now()) {
        storage.delete(key);
        return null;
      }

      // 같은 JS 런루프에서 재진입해도 한 번만 집계되도록 반환보다 삭제가 먼저다.
      storage.delete(key);
      return {
        campaignId: parsed.data.campaignId,
        feature: parsed.data.feature,
      };
    },
  };
}

export const featureAttribution = createFeatureAttributionStore(mmkvSyncStorage);

export function trackAttributedFeatureSuccess(
  analytics: Analytics,
  attribution: FeatureAttributionStore,
  input: ConsumeAttributionInput,
): boolean {
  const consumed = attribution.consume(input);
  if (!consumed) {
    return false;
  }

  analytics.trackEvent('feature_action_success', {
    campaign_id: consumed.campaignId,
    feature: consumed.feature,
  });
  return true;
}

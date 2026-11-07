import type { Analytics } from '@src/core/ports/analytics';
import type { Logger } from '@src/core/ports/logger';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { DAY_MS } from '@src/shared/constants/time-units';
import { getErrorMessage } from '@src/shared/errors';
import { z } from 'zod';

import { FEATURE_ATTRIBUTION_LOG_EVENT } from './feature-attribution-log-events';
import { FEATURE_KEYS, type FeatureKey } from './feature-key';
import { track } from './track';

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

interface ConsumedFeatureAttribution {
  campaignId: string;
  feature: FeatureKey;
}

export interface FeatureAttributionStore {
  record(input: RecordAttributionInput): void;
  consume(input: ConsumeAttributionInput): ConsumedFeatureAttribution | null;
}

function attributionKey(accountId: string, feature: FeatureKey): string {
  return `${KEY_PREFIX}:${accountId}:${feature}`;
}

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
      const raw = storage.get(key);
      if (!raw) {
        return null;
      }

      let decoded: unknown;
      try {
        decoded = JSON.parse(raw);
      } catch {
        storage.remove(key);
        return null;
      }

      const parsed = persistedAttributionSchema.safeParse(decoded);
      if (!parsed.success || parsed.data.feature !== feature || parsed.data.expiresAt < now()) {
        storage.remove(key);
        return null;
      }

      // 같은 JS 런루프에서 재진입해도 한 번만 집계되도록 반환보다 삭제가 먼저다.
      storage.remove(key);
      return {
        campaignId: parsed.data.campaignId,
        feature: parsed.data.feature,
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
): boolean {
  try {
    const consumed = attribution.consume(input);
    if (!consumed) {
      return false;
    }

    track(analytics, 'feature_action_success', {
      campaign_id: consumed.campaignId,
      feature: consumed.feature,
    });
    return true;
  } catch (error) {
    // 분석과 로컬 귀속은 best-effort다. 실제 기능 성공 후 캐시 갱신,
    // 토스트, 화면 전환 같은 사용자 흐름을 절대 중단시키지 않는다.
    logger.warn(FEATURE_ATTRIBUTION_LOG_EVENT.SUCCESS_TRACK_FAILED, {
      error: getErrorMessage(error),
    });
    return false;
  }
}

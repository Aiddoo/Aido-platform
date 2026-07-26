import type { SyncStorage } from '@src/core/ports/sync-storage';

const SEEN_KEY_PREFIX = 'aido_feature_discovery_seen_v1';
const REENTRY_KEY_PREFIX = 'aido_feature_discovery_reentry_v1';
const REENTRY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

interface FeatureDiscoveryStateIdentity {
  userId: string;
  campaignId: string;
}

interface ClaimFeatureDiscoverySeenInput extends FeatureDiscoveryStateIdentity {
  at: Date;
}

interface FeatureDiscoveryReentryInput extends FeatureDiscoveryStateIdentity {
  now: Date;
}

export const featureDiscoverySeenKey = ({
  userId,
  campaignId,
}: FeatureDiscoveryStateIdentity): string => `${SEEN_KEY_PREFIX}:${userId}:${campaignId}`;

const featureDiscoveryReentryKey = ({
  userId,
  campaignId,
}: FeatureDiscoveryStateIdentity): string => `${REENTRY_KEY_PREFIX}:${userId}:${campaignId}`;

export function isFeatureDiscoverySeen(
  storage: SyncStorage,
  identity: FeatureDiscoveryStateIdentity,
): boolean {
  try {
    return storage.getString(featureDiscoverySeenKey(identity)) !== undefined;
  } catch {
    return true;
  }
}

/**
 * MMKV의 동기 get/set을 한 JS 런루프에서 연속 수행해 같은 계정·캠페인을 한 번만 claim한다.
 * 본 상태를 먼저 기록하므로 바텀시트가 열리기 전에 재진입 호출도 차단된다.
 */
export function claimFeatureDiscoverySeen(
  storage: SyncStorage,
  { at, ...identity }: ClaimFeatureDiscoverySeenInput,
): boolean {
  try {
    if (isFeatureDiscoverySeen(storage, identity)) {
      return false;
    }

    const seenAt = at.toISOString();
    storage.set(featureDiscoverySeenKey(identity), seenAt);
    storage.set(featureDiscoveryReentryKey(identity), seenAt);
    return true;
  } catch {
    return false;
  }
}

export function isFeatureDiscoveryReentryVisible(
  storage: SyncStorage,
  { now, ...identity }: FeatureDiscoveryReentryInput,
): boolean {
  let raw: string | undefined;
  try {
    raw = storage.getString(featureDiscoveryReentryKey(identity));
  } catch {
    return false;
  }
  if (!raw) {
    return false;
  }

  const openedAt = new Date(raw).getTime();
  const elapsed = now.getTime() - openedAt;
  return !Number.isNaN(openedAt) && elapsed >= 0 && elapsed < REENTRY_WINDOW_MS;
}

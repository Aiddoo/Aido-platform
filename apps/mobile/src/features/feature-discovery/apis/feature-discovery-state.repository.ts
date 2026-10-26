import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

const SEEN_KEY_PREFIX = 'aido_feature_discovery_seen_v1';
const REENTRY_KEY_PREFIX = 'aido_feature_discovery_reentry_v1';
const REENTRY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
// 재진입 키에는 처음 본 시각(ISO)만 둔다. 손상된 값은 표시하지 않는 쪽으로 읽는다
const reentryOpenedAtSchema = z.iso.datetime();

export interface FeatureDiscoveryStateIdentity {
  userId: string;
  campaignId: string;
}

export interface ClaimFeatureDiscoverySeenInput extends FeatureDiscoveryStateIdentity {
  at: Date;
}

export interface FeatureDiscoveryReentryInput extends FeatureDiscoveryStateIdentity {
  now: Date;
}

export interface FeatureDiscoveryStateRepository {
  isSeen(identity: FeatureDiscoveryStateIdentity): boolean;
  claimSeen(input: ClaimFeatureDiscoverySeenInput): boolean;
  isReentryVisible(input: FeatureDiscoveryReentryInput): boolean;
  dismissReentry(identity: FeatureDiscoveryStateIdentity): void;
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
    return storage.getString(featureDiscoverySeenKey(identity)) != null;
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
  const parsed = reentryOpenedAtSchema.safeParse(raw);
  if (!parsed.success) {
    return false;
  }

  const elapsed = now.getTime() - new Date(parsed.data).getTime();
  return elapsed >= 0 && elapsed < REENTRY_WINDOW_MS;
}

/**
 * 재진입 카드를 닫으면 그 계정·캠페인의 재진입 시각을 지운다. 본 상태는 남아 있어 다시 claim되지 않으므로
 * 같은 캠페인에서는 카드가 돌아오지 않고, 새 캠페인은 자기 키로 다시 보인다
 */
export function dismissFeatureDiscoveryReentry(
  storage: SyncStorage,
  identity: FeatureDiscoveryStateIdentity,
): void {
  try {
    storage.delete(featureDiscoveryReentryKey(identity));
  } catch {
    // 지우지 못하면 카드가 그대로 남아 다시 닫을 수 있다
  }
}

export function createFeatureDiscoveryStateRepository(
  storage: SyncStorage,
): FeatureDiscoveryStateRepository {
  return {
    isSeen: (identity) => isFeatureDiscoverySeen(storage, identity),
    claimSeen: (input) => claimFeatureDiscoverySeen(storage, input),
    isReentryVisible: (input) => isFeatureDiscoveryReentryVisible(storage, input),
    dismissReentry: (identity) => dismissFeatureDiscoveryReentry(storage, identity),
  };
}

import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { type Instant, instantSchema } from '@src/shared/date/instant';

import { WhatsNewPolicy } from '../domains/whats-new.model';

const SEEN_KEY_PREFIX = 'aido_feature_discovery_seen_v1';
const REENTRY_KEY_PREFIX = 'aido_feature_discovery_reentry_v1';

interface WhatsNewIdentity {
  userId: string;
  campaignId: string;
}

export interface WhatsNewRepository {
  hasSeen(identity: WhatsNewIdentity): boolean;
  findReentryOpenedAt(identity: WhatsNewIdentity): Instant | null;
  subscribe(identity: WhatsNewIdentity, listener: () => void): () => void;
  claimSeen(identity: WhatsNewIdentity, at: Instant): boolean;
  dismissReentry(identity: WhatsNewIdentity): void;
  /** 번들에서 빠진 캠페인의 키와 기간이 지난 재진입 키를 지운다 */
  removeRetiredKeys(input: { campaignIds: readonly string[]; now: Instant }): void;
  removeAccount(userId: string): void;
}

function createWhatsNewSeenKey({ userId, campaignId }: WhatsNewIdentity): string {
  return `${SEEN_KEY_PREFIX}:${userId}:${campaignId}`;
}

function createWhatsNewReentryKey({ userId, campaignId }: WhatsNewIdentity): string {
  return `${REENTRY_KEY_PREFIX}:${userId}:${campaignId}`;
}

/** 손상된 시각은 없는 것으로 읽어 카드를 보이지 않는다 */
function parseSavedInstant(saved: string | undefined): Instant | null {
  const parsed = instantSchema.safeParse(saved);

  return parsed.success ? parsed.data : null;
}

/** 저장 키는 계정·캠페인별이다. 1.14 이하가 쓴 값을 그대로 읽어 이미 본 사람에게 다시 뜨지 않는다 */
export function createWhatsNewRepository(
  storage: ObservableSyncStorage & Pick<EnumerableSyncStorage, 'keys'>,
): WhatsNewRepository {
  return {
    hasSeen: (identity) => storage.get(createWhatsNewSeenKey(identity)) != null,
    findReentryOpenedAt: (identity) =>
      parseSavedInstant(storage.get(createWhatsNewReentryKey(identity))),
    subscribe: (identity, listener) => {
      const unsubscribeSeen = storage.subscribe(createWhatsNewSeenKey(identity), listener);
      const unsubscribeReentry = storage.subscribe(createWhatsNewReentryKey(identity), listener);
      return () => {
        unsubscribeSeen();
        unsubscribeReentry();
      };
    },

    /** MMKV의 동기 get/set을 한 JS 런루프에서 연속 수행해 같은 계정·캠페인을 한 번만 claim한다 */
    claimSeen: (identity, at) => {
      try {
        if (storage.get(createWhatsNewSeenKey(identity)) != null) {
          return false;
        }
        storage.set(createWhatsNewSeenKey(identity), at);
        storage.set(createWhatsNewReentryKey(identity), at);
        return true;
      } catch {
        return false;
      }
    },

    dismissReentry: (identity) => {
      try {
        storage.remove(createWhatsNewReentryKey(identity));
      } catch {
        // 지우지 못하면 카드가 그대로 남아 다시 닫을 수 있다
      }
    },

    removeRetiredKeys: ({ campaignIds, now }) => {
      storage
        .keys()
        .filter((key) => {
          if (!key.startsWith(`${SEEN_KEY_PREFIX}:`) && !key.startsWith(`${REENTRY_KEY_PREFIX}:`)) {
            return false;
          }
          if (!campaignIds.includes(key.slice(key.lastIndexOf(':') + 1))) {
            return true;
          }
          return (
            key.startsWith(`${REENTRY_KEY_PREFIX}:`) &&
            !WhatsNewPolicy.shouldShowReentry(parseSavedInstant(storage.get(key)), now)
          );
        })
        .forEach((key) => storage.remove(key));
    },

    removeAccount: (userId) => {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${SEEN_KEY_PREFIX}:${userId}:`) ||
            key.startsWith(`${REENTRY_KEY_PREFIX}:${userId}:`),
        )
        .forEach((key) => storage.remove(key));
    },
  };
}

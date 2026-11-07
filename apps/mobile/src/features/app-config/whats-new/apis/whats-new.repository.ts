import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { type Instant, instantSchema } from '@src/shared/date/instant';

import { WhatsNewPolicy } from '../domains/whats-new.model';

const SEEN_KEY_PREFIX = 'aido_feature_discovery_seen_v1';
const REENTRY_KEY_PREFIX = 'aido_feature_discovery_reentry_v1';

export interface WhatsNewIdentity {
  userId: string;
  campaignId: string;
}

export interface WhatsNewRepository {
  claimSeen(identity: WhatsNewIdentity, at: Instant): boolean;
  dismissReentry(identity: WhatsNewIdentity): void;
  /** 번들에서 빠진 캠페인의 키와 기간이 지난 재진입 키를 지운다 */
  removeRetiredKeys(input: { campaignIds: readonly string[]; now: Instant }): void;
  /** 탈퇴한 계정의 키를 지운다 */
  removeAccount(userId: string): void;
}

export function createWhatsNewSeenKey({ userId, campaignId }: WhatsNewIdentity): string {
  return `${SEEN_KEY_PREFIX}:${userId}:${campaignId}`;
}

export function createWhatsNewReentryKey({ userId, campaignId }: WhatsNewIdentity): string {
  return `${REENTRY_KEY_PREFIX}:${userId}:${campaignId}`;
}

/** 손상된 시각은 없는 것으로 읽어 카드를 보이지 않는다 */
export function parseReentryOpenedAt(saved: string | undefined): Instant | null {
  const parsed = instantSchema.safeParse(saved);

  return parsed.success ? parsed.data : null;
}

/** 저장 키는 계정·캠페인별이다. 1.14 이하가 쓴 값을 그대로 읽어 이미 본 사람에게 다시 뜨지 않는다 */
export function createWhatsNewRepository(
  storage: SyncStorage & Pick<EnumerableSyncStorage, 'keys'>,
): WhatsNewRepository {
  return {
    /**
     * MMKV의 동기 get/set을 한 JS 런루프에서 연속 수행해 같은 계정·캠페인을 한 번만 claim한다.
     * 본 상태를 먼저 기록하므로 화면이 열리기 전에 재진입 호출도 차단된다.
     */
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

    /** 본 기록은 남아 다시 claim되지 않으므로 같은 캠페인의 카드는 돌아오지 않고, 새 캠페인은 자기 키로 보인다 */
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
            !WhatsNewPolicy.shouldShowReentry(parseReentryOpenedAt(storage.get(key)), now)
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

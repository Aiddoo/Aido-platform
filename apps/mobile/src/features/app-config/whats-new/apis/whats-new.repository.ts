import type { SyncStorage } from '@src/core/ports/sync-storage';
import { type Instant, instantSchema } from '@src/shared/date/instant';

const SEEN_KEY_PREFIX = 'aido_feature_discovery_seen_v1';
const REENTRY_KEY_PREFIX = 'aido_feature_discovery_reentry_v1';

export interface WhatsNewIdentity {
  userId: string;
  campaignId: string;
}

export interface WhatsNewRepository {
  isSeen(identity: WhatsNewIdentity): boolean;
  claimSeen(identity: WhatsNewIdentity, at: Instant): boolean;
  getReentryOpenedAt(identity: WhatsNewIdentity): Instant | null;
  dismissReentry(identity: WhatsNewIdentity): void;
}

export function whatsNewSeenKey({ userId, campaignId }: WhatsNewIdentity): string {
  return `${SEEN_KEY_PREFIX}:${userId}:${campaignId}`;
}

function whatsNewReentryKey({ userId, campaignId }: WhatsNewIdentity): string {
  return `${REENTRY_KEY_PREFIX}:${userId}:${campaignId}`;
}

/** 저장 키는 계정·캠페인별이다. 1.14 이하가 쓴 값을 그대로 읽어 이미 본 사람에게 다시 뜨지 않는다 */
export function createWhatsNewRepository(storage: SyncStorage): WhatsNewRepository {
  function isSeen(identity: WhatsNewIdentity): boolean {
    try {
      return storage.get(whatsNewSeenKey(identity)) != null;
    } catch {
      return true;
    }
  }

  return {
    isSeen,

    /**
     * MMKV의 동기 get/set을 한 JS 런루프에서 연속 수행해 같은 계정·캠페인을 한 번만 claim한다.
     * 본 상태를 먼저 기록하므로 화면이 열리기 전에 재진입 호출도 차단된다.
     */
    claimSeen(identity, at) {
      try {
        if (isSeen(identity)) {
          return false;
        }
        storage.set(whatsNewSeenKey(identity), at);
        storage.set(whatsNewReentryKey(identity), at);
        return true;
      } catch {
        return false;
      }
    },

    getReentryOpenedAt(identity) {
      try {
        const parsed = instantSchema.safeParse(storage.get(whatsNewReentryKey(identity)));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },

    /** 본 기록은 남아 다시 claim되지 않으므로 같은 캠페인의 카드는 돌아오지 않고, 새 캠페인은 자기 키로 보인다 */
    dismissReentry(identity) {
      try {
        storage.remove(whatsNewReentryKey(identity));
      } catch {
        // 지우지 못하면 카드가 그대로 남아 다시 닫을 수 있다
      }
    },
  };
}

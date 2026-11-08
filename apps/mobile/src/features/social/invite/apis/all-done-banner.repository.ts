import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';

const ALL_DONE_BANNER_KEY_PREFIX = 'aido_invite_all_done_banner_dismissed_v1';

export interface AllDoneBannerRepository {
  /** 마지막으로 닫은 날짜 key. 닫은 적 없으면 null */
  findDismissedOn(userId: string): string | null;
  dismiss(userId: string, dateKey: string): void;
  subscribe(userId: string, listener: () => void): () => void;
}

function createAllDoneBannerKey(userId: string): string {
  return `${ALL_DONE_BANNER_KEY_PREFIX}:${userId}`;
}

/** "오늘은 그만 보기"를 계정마다 하루 한 칸만 남긴다(날짜가 바뀌면 이전 기록을 덮어쓴다) */
export function createAllDoneBannerRepository(
  storage: ObservableSyncStorage,
): AllDoneBannerRepository {
  return {
    findDismissedOn: (userId) => storage.get(createAllDoneBannerKey(userId)) ?? null,
    dismiss: (userId, dateKey) => {
      try {
        storage.set(createAllDoneBannerKey(userId), dateKey);
      } catch {
        // 저장하지 못하면 배너가 한 번 더 보일 뿐이다.
      }
    },
    subscribe: (userId, listener) => storage.subscribe(createAllDoneBannerKey(userId), listener),
  };
}

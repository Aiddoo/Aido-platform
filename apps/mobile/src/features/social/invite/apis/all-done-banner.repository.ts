import type { SyncStorage } from '@src/core/ports/sync-storage';

const ALL_DONE_BANNER_KEY_PREFIX = 'aido_invite_all_done_banner_dismissed_v1';

export interface AllDoneBannerRepository {
  dismiss(userId: string, dateKey: string): void;
}

export function createAllDoneBannerStorageKey(userId: string): string {
  return `${ALL_DONE_BANNER_KEY_PREFIX}:${userId}`;
}

/** "오늘은 그만 보기"를 계정마다 하루 한 칸만 남긴다(날짜가 바뀌면 이전 기록을 덮어쓴다) */
export function createAllDoneBannerRepository(storage: SyncStorage): AllDoneBannerRepository {
  return {
    dismiss: (userId, dateKey) => {
      try {
        storage.set(createAllDoneBannerStorageKey(userId), dateKey);
      } catch {
        // 저장하지 못하면 배너가 한 번 더 보일 뿐이다.
      }
    },
  };
}

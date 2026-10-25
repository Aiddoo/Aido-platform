import type { ObservableSyncStorage } from '@src/core/ports/sync-storage';

const ALL_DONE_BANNER_KEY_PREFIX = 'aido_invite_all_done_banner_dismissed_v1';

export interface AllDoneBannerRepository {
  isDismissed(userId: string, dateKey: string): boolean;
  dismiss(userId: string, dateKey: string): void;
  /** 이 계정의 닫기 기록이 바뀌면 알린다. 다른 화면에서 닫아도 배너가 따라간다 */
  subscribe(userId: string, listener: () => void): () => void;
}

/** "오늘은 그만 보기"를 계정마다 하루 한 칸만 남긴다(날짜가 바뀌면 이전 기록을 덮어쓴다) */
export function createAllDoneBannerRepository(
  storage: ObservableSyncStorage,
): AllDoneBannerRepository {
  const toKey = (userId: string) => `${ALL_DONE_BANNER_KEY_PREFIX}:${userId}`;

  return {
    isDismissed: (userId, dateKey) => storage.getString(toKey(userId)) === dateKey,
    dismiss: (userId, dateKey) => storage.set(toKey(userId), dateKey),
    subscribe: (userId, listener) => storage.subscribe(toKey(userId), listener),
  };
}

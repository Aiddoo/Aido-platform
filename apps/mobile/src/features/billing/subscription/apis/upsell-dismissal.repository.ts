import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { type EntitlementFeature } from '../domains/entitlement.model';
import { upsellDismissalStorageSchema } from '../schemas/upsell-dismissal-storage.schema';

const UPSELL_DISMISSAL_KEY_PREFIX = 'aido_upsell_dismissed_v1';

export interface UpsellDismissalRepository {
  /** 그 기능의 프리미엄 안내를 마지막으로 닫은 날짜 key. 닫은 적 없으면 null */
  findDismissedOn(userId: string, feature: EntitlementFeature): string | null;
  dismiss(userId: string, feature: EntitlementFeature, dateKey: string): void;
  subscribe(userId: string, listener: () => void): () => void;
  /** 탈퇴한 계정의 기록을 지운다. 로그아웃은 같은 사람이 돌아오므로 남긴다 */
  clear(userId: string): void;
}

function createUpsellDismissalKey(userId: string): string {
  return `${UPSELL_DISMISSAL_KEY_PREFIX}:${userId}`;
}

/** 계정마다 기능별로 마지막에 닫은 날 하나만 남긴다. 깨진 값은 닫은 적 없는 것으로 본다 */
export function createUpsellDismissalRepository(
  storage: ObservableSyncStorage,
): UpsellDismissalRepository {
  const findDismissals = (userId: string) =>
    parseStoredJson(storage.get(createUpsellDismissalKey(userId)), upsellDismissalStorageSchema) ??
    {};

  return {
    findDismissedOn: (userId, feature) => findDismissals(userId)[feature] ?? null,
    dismiss: (userId, feature, dateKey) => {
      try {
        storage.set(
          createUpsellDismissalKey(userId),
          JSON.stringify({ ...findDismissals(userId), [feature]: dateKey }),
        );
      } catch {
        // 저장하지 못하면 같은 날 시트가 한 번 더 보일 뿐이다.
      }
    },
    subscribe: (userId, listener) => storage.subscribe(createUpsellDismissalKey(userId), listener),
    clear: (userId) => storage.remove(createUpsellDismissalKey(userId)),
  };
}

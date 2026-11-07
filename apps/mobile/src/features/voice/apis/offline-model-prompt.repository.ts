import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { SyncStorage } from '@src/core/ports/sync-storage';

const KEY_PREFIX = 'aido_offline_model_declined_v1';

export interface OfflineModelPromptRepository {
  hasDeclined(accountId: string, locale: SpeechLocale): boolean;
  saveDeclined(accountId: string, locale: SpeechLocale): void;
}

function offlineModelDeclinedStorageKey(accountId: string, locale: SpeechLocale) {
  return `${KEY_PREFIX}:${encodeURIComponent(accountId)}:${locale}`;
}

/**
 * 기기 음성 인식 모델을 다시 묻지 않을 언어(거절, 시스템 창 취소, 받을 수 없음). 사용자 범위 로컬 저장소(초안 저장소)에 두므로 로그아웃으로 그 저장소를
 * 비울 때 함께 지워진다. 값을 읽지 못하면 거절하지 않은 것으로 본다(한 번 더 묻는 게 전부다).
 */
export function createOfflineModelPromptRepository(
  storage: SyncStorage,
): OfflineModelPromptRepository {
  return {
    hasDeclined: (accountId, locale) => {
      try {
        return storage.get(offlineModelDeclinedStorageKey(accountId, locale)) != null;
      } catch {
        return false;
      }
    },
    saveDeclined: (accountId, locale) => {
      try {
        storage.set(offlineModelDeclinedStorageKey(accountId, locale), 'declined');
      } catch {
        // 저장하지 못하면 다음 녹음에 한 번 더 물을 뿐이다.
      }
    },
  };
}

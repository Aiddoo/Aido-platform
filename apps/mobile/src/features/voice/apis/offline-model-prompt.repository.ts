import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { SyncStorage } from '@src/core/ports/sync-storage';

const KEY_PREFIX = 'aido_offline_model_declined_v1';

export interface OfflineModelPromptRepository {
  hasDeclined(accountId: string, locale: SpeechLocale): boolean;
  saveDeclined(accountId: string, locale: SpeechLocale): void;
}

function createOfflineModelDeclinedKey(accountId: string, locale: SpeechLocale) {
  return `${KEY_PREFIX}:${encodeURIComponent(accountId)}:${locale}`;
}

/** 기기 인식 모델을 다시 묻지 않을 언어. 사용자 범위 저장소라 로그아웃 때 지워지고, 읽지 못하면 한 번 더 묻는다 */
export function createOfflineModelPromptRepository(
  storage: SyncStorage,
): OfflineModelPromptRepository {
  return {
    hasDeclined: (accountId, locale) => {
      try {
        return storage.get(createOfflineModelDeclinedKey(accountId, locale)) != null;
      } catch {
        return false;
      }
    },
    saveDeclined: (accountId, locale) => {
      try {
        storage.set(createOfflineModelDeclinedKey(accountId, locale), 'declined');
      } catch {
        // 저장하지 못하면 다음 녹음에 한 번 더 물을 뿐이다.
      }
    },
  };
}

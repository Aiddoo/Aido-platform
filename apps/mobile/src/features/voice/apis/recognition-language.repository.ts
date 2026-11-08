import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import type { SyncStorage } from '@src/core/ports/sync-storage';

import { speechLocaleSchema } from '../schemas/speech-locale.schema';

const KEY_PREFIX = 'aido_recognition_language_v1';

export interface RecognitionLanguageRepository {
  find(accountId: string): SpeechLocale | null;
  save(accountId: string, locale: SpeechLocale): void;
  subscribe(listener: () => void): () => void;
}

function recognitionLanguageStorageKey(accountId: string) {
  return `${KEY_PREFIX}:${encodeURIComponent(accountId)}`;
}

/** 사용자 범위 저장소라 로그아웃 때 함께 지워진다. 읽지 못하거나 모르는 값이면 저장하지 않은 것으로 본다 */
export function createRecognitionLanguageRepository(
  storage: SyncStorage,
): RecognitionLanguageRepository {
  const listeners = new Set<() => void>();

  return {
    find: (accountId) => {
      try {
        const parsed = speechLocaleSchema.safeParse(
          storage.get(recognitionLanguageStorageKey(accountId)),
        );
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    save: (accountId, locale) => {
      try {
        storage.set(recognitionLanguageStorageKey(accountId), locale);
      } catch {
        return;
      }
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

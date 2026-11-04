import type { Logger } from '@src/core/ports/logger';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { errorMessageOf } from '@src/shared/errors/to-error';
import { debounce } from 'es-toolkit';

import { VOICE_NOTE_LOG_EVENT } from '../constants/voice-note-log-events';
import { VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS } from '../constants/voice-note.constants';
import { type VoiceNote, voiceNoteSchema } from '../domains/voice-note.model';

const KEY_PREFIX = 'aido_voice_note_draft_v1:';
const KEY_SEPARATOR = ':';

export interface VoiceNoteDraftRepository {
  /** 초안이 바뀌면 부른다. `getSnapshot`과 함께 `useSyncExternalStore`에 넘긴다 */
  subscribe(listener: () => void): () => void;
  /** 내 초안 전체. 바뀌기 전까지 같은 배열을 돌려준다 */
  getSnapshot(accountId: string): readonly VoiceNote[];
  find(accountId: string, draftId: string): VoiceNote | undefined;
  /** 오래된 순서가 아니라 저장소 순서다. 정렬은 쓰는 쪽이 정한다 */
  findAll(accountId: string): VoiceNote[];
  save(accountId: string, note: VoiceNote): void;
  /** 문장이 이어서 들어오는 동안 쓰기를 모은다. 같은 초안끼리만 모은다 */
  scheduleSave(accountId: string, note: VoiceNote): void;
  /** 모아 둔 쓰기를 지금 끝낸다(끝내기·백그라운드 전환) */
  flush(accountId: string, draftId: string): void;
  remove(accountId: string, draftId: string): void;
  removeAllExceptOwner(accountId: string): void;
  removeAll(): void;
}

interface Dependencies {
  storage: EnumerableSyncStorage;
  logger: Pick<Logger, 'warn'>;
  debounceMs?: number;
}

interface PendingSave {
  note: VoiceNote;
  run: ReturnType<typeof debounce<() => void>>;
}

const encodeSegment = (segment: string) => encodeURIComponent(segment);
const createOwnerPrefix = (accountId: string) =>
  `${KEY_PREFIX}${encodeSegment(accountId)}${KEY_SEPARATOR}`;
const createKey = (accountId: string, draftId: string) =>
  `${createOwnerPrefix(accountId)}${encodeSegment(draftId)}`;

export function createVoiceNoteDraftRepository({
  storage,
  logger,
  debounceMs = VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS,
}: Dependencies): VoiceNoteDraftRepository {
  const pendingSaves = new Map<string, PendingSave>();
  const listeners = new Set<() => void>();
  let snapshot: { accountId: string; notes: readonly VoiceNote[] } | null = null;

  const notify = () => {
    snapshot = null;
    listeners.forEach((listener) => listener());
  };

  const read = (key: string): VoiceNote | undefined => {
    const raw = storage.getString(key);
    if (raw == null) {
      return undefined;
    }

    try {
      const parsed = voiceNoteSchema.safeDecode(JSON.parse(raw));
      if (parsed.success) {
        return parsed.data;
      }
      logger.warn(VOICE_NOTE_LOG_EVENT.DRAFT_RESTORE_FAILED, { reason: 'schema-mismatch' });
    } catch (error) {
      logger.warn(VOICE_NOTE_LOG_EVENT.DRAFT_RESTORE_FAILED, {
        reason: 'invalid-json',
        error: errorMessageOf(error),
      });
    }

    storage.delete(key);
    return undefined;
  };

  const write = (accountId: string, note: VoiceNote) => {
    try {
      storage.set(createKey(accountId, note.draftId), JSON.stringify(voiceNoteSchema.encode(note)));
      notify();
    } catch (error) {
      logger.warn(VOICE_NOTE_LOG_EVENT.DRAFT_SAVE_FAILED, { error: errorMessageOf(error) });
    }
  };

  const cancelPending = (key: string) => {
    pendingSaves.get(key)?.run.cancel();
    pendingSaves.delete(key);
  };

  const findKeys = (matches: (key: string) => boolean) =>
    storage.getAllKeys().filter((key) => key.startsWith(KEY_PREFIX) && matches(key));

  const findAllOwned = (accountId: string) =>
    findKeys((key) => key.startsWith(createOwnerPrefix(accountId)))
      .map(read)
      .filter((note): note is VoiceNote => note != null);

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot: (accountId) => {
      if (snapshot?.accountId !== accountId) {
        snapshot = { accountId, notes: findAllOwned(accountId) };
      }
      return snapshot.notes;
    },

    find: (accountId, draftId) => read(createKey(accountId, draftId)),

    findAll: findAllOwned,

    save: (accountId, note) => {
      cancelPending(createKey(accountId, note.draftId));
      write(accountId, note);
    },

    scheduleSave: (accountId, note) => {
      const key = createKey(accountId, note.draftId);
      const pending = pendingSaves.get(key);
      if (pending != null) {
        pending.note = note;
        pending.run();
        return;
      }

      const created: PendingSave = {
        note,
        run: debounce(() => {
          pendingSaves.delete(key);
          write(accountId, created.note);
        }, debounceMs),
      };
      pendingSaves.set(key, created);
      created.run();
    },

    flush: (accountId, draftId) => {
      pendingSaves.get(createKey(accountId, draftId))?.run.flush();
    },

    remove: (accountId, draftId) => {
      const key = createKey(accountId, draftId);
      cancelPending(key);
      storage.delete(key);
      notify();
    },

    removeAllExceptOwner: (accountId) => {
      const ownerPrefix = createOwnerPrefix(accountId);
      for (const key of findKeys((candidate) => !candidate.startsWith(ownerPrefix))) {
        cancelPending(key);
        storage.delete(key);
      }
      notify();
    },

    removeAll: () => {
      for (const key of findKeys(() => true)) {
        cancelPending(key);
        storage.delete(key);
      }
      notify();
    },
  };
}

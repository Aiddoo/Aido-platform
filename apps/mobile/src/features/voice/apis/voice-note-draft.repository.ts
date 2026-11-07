import type { Logger } from '@src/core/ports/logger';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import { getErrorMessage } from '@src/shared/errors/to-error';
// maxWait(계속 쓰는 중에도 이 시간 안에 한 번은 저장)는 메인 패키지 debounce에 없다
import { debounce } from 'es-toolkit/compat';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import {
  VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS,
  VOICE_NOTE_DRAFT_SAVE_MAX_WAIT_MS,
} from '../constants/voice-note.constants';
import { createVoiceNoteSchema, type VoiceNote } from '../schemas/voice-note.schema';

const KEY_PREFIX = 'aido_voice_note_draft_v1:';
const KEY_SEPARATOR = ':';

export interface VoiceNoteDraftRepository {
  subscribe(listener: () => void): () => void;
  /** 내 초안 전체. 바뀌기 전까지 같은 배열을 돌려준다 */
  getSnapshot(accountId: string): readonly VoiceNote[];
  find(accountId: string, draftId: string): VoiceNote | undefined;
  /** 오래된 순서가 아니라 저장소 순서다. 정렬은 쓰는 쪽이 정한다 */
  findAll(accountId: string): VoiceNote[];
  save(accountId: string, note: VoiceNote): void;
  scheduleSave(accountId: string, note: VoiceNote): void;
  flush(accountId: string, draftId: string): void;
  remove(accountId: string, draftId: string): void;
  removeAllExceptOwner(accountId: string): void;
  removeAll(): void;
}

interface Dependencies {
  storage: EnumerableSyncStorage;
  logger: Pick<Logger, 'warn'>;
  /** 옛 초안의 날짜를 읽을 시간대. 시스템 설정 변경이 반영되도록 읽을 때마다 부른다 */
  getTimeZone: () => string;
  debounceMs?: number;
  maxWaitMs?: number;
}

interface PendingSave {
  note: VoiceNote;
  run: ReturnType<typeof debounce<() => void>>;
}

function encodeSegment(segment: string) {
  return encodeURIComponent(segment);
}
function createOwnerPrefix(accountId: string) {
  return `${KEY_PREFIX}${encodeSegment(accountId)}${KEY_SEPARATOR}`;
}
function createKey(accountId: string, draftId: string) {
  return `${createOwnerPrefix(accountId)}${encodeSegment(draftId)}`;
}

export function createVoiceNoteDraftRepository({
  storage,
  logger,
  getTimeZone,
  debounceMs = VOICE_NOTE_DRAFT_SAVE_DEBOUNCE_MS,
  maxWaitMs = VOICE_NOTE_DRAFT_SAVE_MAX_WAIT_MS,
}: Dependencies): VoiceNoteDraftRepository {
  const pendingSaves = new Map<string, PendingSave>();
  const listeners = new Set<() => void>();
  let snapshot: { accountId: string; notes: readonly VoiceNote[] } | null = null;

  const notifyListeners = () => listeners.forEach((listener) => listener());

  const notify = () => {
    snapshot = null;
    notifyListeners();
  };

  /** 쓴 초안 한 건만 스냅샷에서 바꾼다. 녹음 중 저장마다 다른 초안까지 다시 해석하지 않는다 */
  const replaceInSnapshot = (accountId: string, note: VoiceNote) => {
    if (snapshot?.accountId !== accountId) {
      return;
    }
    const hasNote = snapshot.notes.some(({ draftId }) => draftId === note.draftId);
    snapshot = {
      accountId,
      notes: hasNote
        ? snapshot.notes.map((current) => (current.draftId === note.draftId ? note : current))
        : [...snapshot.notes, note],
    };
  };

  const read = (key: string): VoiceNote | undefined => {
    const raw = storage.get(key);
    if (raw == null) {
      return undefined;
    }

    try {
      const parsed = createVoiceNoteSchema(getTimeZone()).safeDecode(JSON.parse(raw));
      if (parsed.success) {
        return parsed.data;
      }
      logger.warn(VOICE_LOG_EVENT.DRAFT_RESTORE_FAILED, { reason: 'schema-mismatch' });
    } catch (error) {
      logger.warn(VOICE_LOG_EVENT.DRAFT_RESTORE_FAILED, {
        reason: 'invalid-json',
        error: getErrorMessage(error),
      });
    }

    storage.remove(key);
    return undefined;
  };

  const write = (accountId: string, note: VoiceNote) => {
    try {
      storage.set(
        createKey(accountId, note.draftId),
        JSON.stringify(createVoiceNoteSchema(getTimeZone()).encode(note)),
      );
      replaceInSnapshot(accountId, note);
      notifyListeners();
    } catch (error) {
      logger.warn(VOICE_LOG_EVENT.DRAFT_SAVE_FAILED, { error: getErrorMessage(error) });
    }
  };

  const cancelPending = (key: string) => {
    pendingSaves.get(key)?.run.cancel();
    pendingSaves.delete(key);
  };

  /** 아직 저장소에 없는 초안의 대기 쓰기도 취소해야 지운 뒤 되살아나지 않는다 */
  const cancelPendingWhere = (matches: (key: string) => boolean) => {
    [...pendingSaves.keys()].filter(matches).forEach(cancelPending);
  };

  const findKeys = (matches: (key: string) => boolean) =>
    storage.keys().filter((key) => key.startsWith(KEY_PREFIX) && matches(key));

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
        run: debounce(
          () => {
            pendingSaves.delete(key);
            write(accountId, created.note);
          },
          debounceMs,
          { maxWait: maxWaitMs },
        ),
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
      storage.remove(key);
      notify();
    },

    removeAllExceptOwner: (accountId) => {
      const ownerPrefix = createOwnerPrefix(accountId);
      const isOtherOwner = (candidate: string) => !candidate.startsWith(ownerPrefix);
      cancelPendingWhere(isOtherOwner);
      findKeys(isOtherOwner).forEach((key) => storage.remove(key));
      notify();
    },

    removeAll: () => {
      cancelPendingWhere(() => true);
      findKeys(() => true).forEach((key) => storage.remove(key));
      notify();
    },
  };
}

import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { orderBy, partition, sumBy } from 'es-toolkit';

import { VoiceNotePolicy, type VoiceNote } from '../domains/voice-note.model';
import type { VoiceNoteDraftRepository } from '../repositories/voice-note-draft.repository';
import type { VoiceRecordingRepository } from '../repositories/voice-recording.repository';

export interface VoiceNoteRecordingUsage {
  /** 아래 메모들의 녹음 크기 합. 메모에 속하지 않은 파일은 사용자가 볼 수도 지울 수도 없어 넣지 않는다 */
  totalBytes: number;
  notes: { note: VoiceNote; bytes: number }[];
}

/** 기기에 저장하는 말로 메모하기 초안과 녹음 파일(서버로 보내지 않는다). 둘은 항상 함께 지우고 사용자 범위를 지킨다 */
export class VoiceNoteStorageService {
  readonly #drafts: VoiceNoteDraftRepository;
  readonly #recordings: VoiceRecordingRepository;
  readonly #now: () => Instant;

  constructor(
    drafts: VoiceNoteDraftRepository,
    recordings: VoiceRecordingRepository,
    now: () => Instant,
  ) {
    this.#drafts = drafts;
    this.#recordings = recordings;
    this.#now = now;
  }

  /** 아직 쓰지 않은 대기 쓰기도 함께 취소해 지운 초안이 되살아나지 않게 한다 */
  discard = (accountId: string, draftId: string): void => {
    const note = this.#drafts.find(accountId, draftId);
    if (note != null) {
      this.#removeFiles(accountId, note);
    }
    this.#drafts.remove(accountId, draftId);
  };

  getRecordingUsage = (accountId: string): VoiceNoteRecordingUsage => {
    const sizes = this.#recordings.getFileSizes(accountId);
    const notes = this.#drafts
      .findAll(accountId)
      .filter(VoiceNotePolicy.canPlayRecording)
      .map((note) => ({ note, bytes: VoiceNotePolicy.getRecordingSizeBytes(note, sizes) }));

    return {
      totalBytes: sumBy(notes, ({ bytes }) => bytes),
      notes: orderBy(notes, [({ note }) => toEpochMs(note.createdAt)], ['desc']),
    };
  };

  removeRecordings = (accountId: string, draftId: string): void => {
    const note = this.#drafts.find(accountId, draftId);
    if (note == null) {
      return;
    }
    this.#removeFiles(accountId, note);
    this.#drafts.save(accountId, VoiceNotePolicy.withoutRecordings(note));
  };

  removeAllRecordings = (accountId: string): void => {
    this.#recordings.removeOwned(accountId);
    this.#drafts
      .findAll(accountId)
      .filter((note) => note.recordings.length > 0)
      .forEach((note) => this.#drafts.save(accountId, VoiceNotePolicy.withoutRecordings(note)));
  };

  removeExpired = (accountId: string): void => {
    const now = this.#now();
    const [expired, alive] = partition(this.#drafts.findAll(accountId), (note) =>
      VoiceNotePolicy.isExpired(note, now),
    );
    expired.forEach((note) => this.#remove(accountId, note));

    const referencedFileNames = new Set(
      alive.flatMap((note) => note.recordings.map((recording) => recording.fileName)),
    );
    this.#recordings.removeExpired(accountId, now, referencedFileNames);
  };

  removeAllExceptOwner = (accountId: string): void => {
    this.#drafts.removeAllExceptOwner(accountId);
    this.#recordings.removeAllExceptOwner(accountId);
  };

  removeAll = (): void => {
    this.#drafts.removeAll();
    this.#recordings.removeAll();
  };

  #remove = (accountId: string, note: VoiceNote): void => {
    this.#removeFiles(accountId, note);
    this.#drafts.remove(accountId, note.draftId);
  };

  #removeFiles = (accountId: string, note: VoiceNote): void => {
    note.recordings.forEach(({ fileName }) => this.#recordings.remove(accountId, fileName));
  };
}

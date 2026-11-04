import { partition } from 'es-toolkit';

import { type VoiceNote, VoiceNotePolicy } from '../domains/voice-note.model';
import type { VoiceNoteDraftRepository } from './voice-note-draft.repository';
import type { VoiceRecordingRepository } from './voice-recording.repository';

/** 기기 안에만 있는 말로 메모하기 초안과 녹음 파일. 둘은 항상 함께 지우고 사용자 범위를 지킨다 */
export class VoiceNoteStorageService {
  readonly drafts: VoiceNoteDraftRepository;
  readonly recordings: VoiceRecordingRepository;
  readonly #now: () => Date;

  constructor(
    drafts: VoiceNoteDraftRepository,
    recordings: VoiceRecordingRepository,
    now: () => Date = () => new Date(),
  ) {
    this.drafts = drafts;
    this.recordings = recordings;
    this.#now = now;
  }

  discard = (accountId: string, draftId: string): void => {
    const note = this.drafts.find(accountId, draftId);
    if (note != null) {
      this.#remove(accountId, note);
    }
  };

  /** 30일이 지난 초안과 그 녹음, 어느 초안에도 속하지 않고 기한이 지난 녹음 파일을 지운다 */
  removeExpired = (accountId: string): void => {
    const now = this.#now();
    const [expired, alive] = partition(this.drafts.findAll(accountId), (note) =>
      VoiceNotePolicy.isExpired(note, now),
    );
    expired.forEach((note) => this.#remove(accountId, note));

    const referencedFileNames = new Set(
      alive.flatMap((note) => (note.recordingFileName == null ? [] : [note.recordingFileName])),
    );
    this.recordings.removeExpired(accountId, now, referencedFileNames);
  };

  removeAllExceptOwner = (accountId: string): void => {
    this.drafts.removeAllExceptOwner(accountId);
    this.recordings.removeAllExceptOwner(accountId);
  };

  /** 로그아웃·탈퇴 */
  removeAll = (): void => {
    this.drafts.removeAll();
    this.recordings.removeAll();
  };

  #remove(accountId: string, note: VoiceNote): void {
    if (note.recordingFileName != null) {
      this.recordings.remove(accountId, note.recordingFileName);
    }
    this.drafts.remove(accountId, note.draftId);
  }
}

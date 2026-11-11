import type { SpeechRecognizer } from '@src/core/ports/speech-recognizer';
import { orderBy } from 'es-toolkit';

import {
  VOICE_RECORDING_LATE_WAIT_MS,
  VOICE_RECORDING_SAVE_WAIT_MS,
} from '../constants/voice-note.constants';
import { VoiceNotePolicy, type VoiceNoteRecording } from '../domains/voice-note.model';
import type { VoiceNoteDraftRepository } from '../repositories/voice-note-draft.repository';
import type { VoiceRecordingRepository } from '../repositories/voice-recording.repository';
import type { VoiceNoteStorageService } from './voice-note-storage.service';

interface VoiceRecordingIntakeSessionDeps {
  accountId: string;
  draftId: string;
  draftRepository: Pick<VoiceNoteDraftRepository, 'find' | 'save'>;
  recordingRepository: Pick<VoiceRecordingRepository, 'remove' | 'removeSource' | 'save'>;
  discard: VoiceNoteStorageService['discard'];
  /** 조각 하나를 초안 이름으로 옮겼다 */
  onRecordingSaved: () => void;
}

/** 인식기 파일은 화면이 내려간 뒤에도 올 수 있어 React 밖에서 받는다. 지운 초안의 파일만 바로 지운다 */
export class VoiceRecordingIntakeSession {
  readonly #deps: VoiceRecordingIntakeSessionDeps;
  readonly #segmentStarts = new Map<string, number>();
  readonly #pendingSaves = new Set<Promise<void>>();
  #recordings: VoiceNoteRecording[] = [];
  #partCount = 0;
  #notifyArrived: (() => void) | null = null;
  #stopLateListening: (() => void) | null = null;
  /** 정리 화면으로 넘겼다. 이제 초안의 주인은 그 화면이라 녹음 조각만 더한다 */
  #hasHandedOff = false;
  /** 사용자가 초안을 지웠다. 뒤늦은 글자·파일이 초안을 되살리지 않게 막는다 */
  #hasDiscarded = false;

  constructor(deps: VoiceRecordingIntakeSessionDeps) {
    this.#deps = deps;
  }

  segmentStarted = (uri: string, startMs: number): void => {
    this.#segmentStarts.set(uri, startMs);
  };

  receive = (uri: string, fallbackStartMs: number): void => {
    const startMs = this.#segmentStarts.get(uri) ?? fallbackStartMs;
    this.#segmentStarts.delete(uri);
    if (this.#hasDiscarded) {
      this.#deps.recordingRepository.removeSource(uri);
    } else {
      const saving = this.#save(uri, startMs).finally(() => this.#pendingSaves.delete(saving));
      this.#pendingSaves.add(saving);
    }
    if (this.#segmentStarts.size === 0) {
      this.#notifyArrived?.();
    }
  };

  /** 일시정지·한도 직후에 끝내면 파일이 아직 안 왔을 수 있어 잠깐 기다린다 */
  waitUntilSettled = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      if (this.#segmentStarts.size === 0) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, VOICE_RECORDING_SAVE_WAIT_MS);
      this.#notifyArrived = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    this.#notifyArrived = null;
    await Promise.allSettled(this.#pendingSaves);
  };

  handOff = (): void => {
    this.#hasHandedOff = true;
  };

  discard = (): void => {
    const { accountId, draftId, recordingRepository, discard } = this.#deps;
    this.#hasDiscarded = true;
    this.#recordings.forEach(({ fileName }) => recordingRepository.remove(accountId, fileName));
    discard(accountId, draftId);
  };

  getRecordings = (): readonly VoiceNoteRecording[] => this.#recordings;

  isDiscarded = (): boolean => this.#hasDiscarded;

  /** 넘기거나 지운 뒤에는 글자를 초안에 쓰지 않는다 */
  canWriteDraft = (): boolean => !this.#hasHandedOff && !this.#hasDiscarded;

  /** 떠나도 녹음을 잃지 않게 화면이 내려간 뒤 온 파일도 받는다. 받으면 끝내고 오지 않아도 잠시 뒤 끝낸다 */
  listenForLate = (subscribe: SpeechRecognizer['subscribe']): void => {
    if (this.#segmentStarts.size === 0) {
      return;
    }
    // 다시 불리면(화면 재마운트) 앞의 듣기를 풀어 구독과 타이머가 겹쳐 남지 않게 한다
    this.#stopLateListening?.();
    const stop = () => {
      clearTimeout(timer);
      unsubscribe();
      if (this.#stopLateListening === stop) {
        this.#stopLateListening = null;
      }
    };
    this.#stopLateListening = stop;
    const unsubscribe = subscribe((event) => {
      // 30초 안에 새 녹음을 시작하면 그 파일의 이벤트도 여기로 온다. 옮기면 새 녹음의 조각이 사라진다
      if (event.type !== 'recording-saved' || !this.#segmentStarts.has(event.uri)) {
        return;
      }
      this.receive(event.uri, 0);
      if (this.#segmentStarts.size === 0) {
        stop();
      }
    });
    const timer = setTimeout(stop, VOICE_RECORDING_LATE_WAIT_MS);
  };

  #save = async (sourceUri: string, startMs: number): Promise<void> => {
    const { accountId, draftId, draftRepository, recordingRepository, onRecordingSaved } =
      this.#deps;
    const partIndex = this.#partCount;
    this.#partCount += 1;
    const fileName = await recordingRepository.save({ accountId, draftId, partIndex, sourceUri });
    if (fileName == null) {
      return;
    }
    if (this.#hasDiscarded) {
      recordingRepository.remove(accountId, fileName);
      return;
    }
    this.#recordings = orderBy(
      [...this.#recordings, { fileName, startMs }],
      [({ startMs: partStartMs }) => partStartMs],
      ['asc'],
    );
    onRecordingSaved();
    if (!this.#hasHandedOff) {
      return;
    }
    const handedOff = draftRepository.find(accountId, draftId);
    if (handedOff == null) {
      // 넘긴 뒤 툴바에서 메모를 지웠다. 이 파일을 담을 초안이 없으니 기기에 남기지 않는다
      recordingRepository.remove(accountId, fileName);
      return;
    }
    draftRepository.save(accountId, VoiceNotePolicy.withRecordings(handedOff, this.#recordings));
  };
}

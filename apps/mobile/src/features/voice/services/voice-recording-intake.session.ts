import type { SpeechRecognizer } from '@src/core/ports/speech-recognizer';
import type { SignOutEpoch } from '@src/core/session/sign-out-epoch';
import { orderBy } from 'es-toolkit';

import {
  VOICE_RECORDING_LATE_WAIT_MS,
  VOICE_RECORDING_SAVE_WAIT_MS,
} from '../constants/voice-note.constants';
import { VoiceNotePolicy, type VoiceNoteRecording } from '../domains/voice-note.model';
import type { VoiceNoteDraftRepository } from '../repositories/voice-note-draft.repository';
import type { VoiceRecordingRepository } from '../repositories/voice-recording.repository';
import type { VoiceNoteStorageService } from './voice-note-storage.service';

interface VoiceRecordingIntakeSessionPorts {
  accountId: string;
  draftId: string;
  draftRepository: Pick<VoiceNoteDraftRepository, 'find' | 'save'>;
  recordingRepository: Pick<
    VoiceRecordingRepository,
    'findSourceOwner' | 'releaseSource' | 'remove' | 'removeSource' | 'reserveSource' | 'save'
  >;
  discard: VoiceNoteStorageService['discard'];
  /** 로그아웃·탈퇴하면 늦은 파일을 지운 계정 폴더·초안에 쓰지 않는다. 세션 만료는 같은 사람이 돌아오므로 받는다 */
  signOutEpoch: Pick<SignOutEpoch, 'current' | 'subscribe'>;
  /** 조각 하나를 초안 이름으로 옮겼다 */
  onRecordingSaved: () => void;
}

/**
 * 인식기 파일은 화면이 내려간 뒤에도 올 수 있어 React 밖에서 받는다. 지운 초안의 파일만 바로 지운다.
 * 세션을 만든 훅이 수명을 정한다: 붙을 때 `reclaim`, 놓을 때 `listenForLate`를 부른다. 놓은 뒤에는 기다리던 파일을
 * 받거나 시간이 지나면 세션이 스스로 `dispose`한다
 */
export class VoiceRecordingIntakeSession {
  readonly #deps: VoiceRecordingIntakeSessionPorts;
  readonly #segmentStarts = new Map<string, number>();
  readonly #pendingSaves = new Set<Promise<void>>();
  readonly #startedEpoch: number;
  #recordings: VoiceNoteRecording[] = [];
  #partCount = 0;
  #notifyArrived: (() => void) | null = null;
  #stopLateListening: (() => void) | null = null;
  /** 늦은 파일을 듣고 있는 인식기 구독 함수. 같은 인식기를 화면이 다시 들으면 이 듣기를 거둔다 */
  #lateSubscribe: SpeechRecognizer['subscribe'] | null = null;
  /** 정리 화면으로 넘겼다. 이제 초안의 주인은 그 화면이라 녹음 조각만 더한다 */
  #hasHandedOff = false;
  /** 사용자가 초안을 지웠다. 뒤늦은 글자·파일이 초안을 되살리지 않게 막는다 */
  #hasDiscarded = false;

  constructor(deps: VoiceRecordingIntakeSessionPorts) {
    this.#deps = deps;
    this.#startedEpoch = deps.signOutEpoch.current();
  }

  segmentStarted = (uri: string, startMs: number): void => {
    this.#segmentStarts.set(uri, startMs);
    this.#deps.recordingRepository.reserveSource(uri, this.#deps.draftId);
  };

  receive = (uri: string, fallbackStartMs: number): void => {
    const { draftId, recordingRepository } = this.#deps;
    const startMs = this.#segmentStarts.get(uri) ?? fallbackStartMs;
    this.#segmentStarts.delete(uri);
    const owner = recordingRepository.findSourceOwner(uri);
    // 다른 초안이 맡은 파일은 이 화면의 구독이 먼저 받아도 옮기거나 지우지 않는다. 기다리던 끝내기만 아래에서 풀어 준다
    if (owner == null || owner === draftId) {
      this.#take(uri, startMs);
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
    for (const { fileName } of this.#recordings) {
      recordingRepository.remove(accountId, fileName);
    }
    discard(accountId, draftId);
  };

  getRecordings = (): readonly VoiceNoteRecording[] => this.#recordings;

  isDiscarded = (): boolean => this.#hasDiscarded;

  /** 넘기거나 지웠거나 로그아웃했으면 글자를 초안에 쓰지 않는다 */
  canWriteDraft = (): boolean =>
    !this.#hasHandedOff && !this.#hasDiscarded && !this.#hasSignedOut();

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
      unsubscribeSignOut();
      if (this.#stopLateListening === stop) {
        this.#stopLateListening = null;
        this.#lateSubscribe = null;
      }
    };
    this.#stopLateListening = stop;
    this.#lateSubscribe = subscribe;
    const finish = () => {
      stop();
      this.dispose();
    };
    const unsubscribe = subscribe((event) => {
      // 30초 안에 새 녹음을 시작하면 그 파일의 이벤트도 여기로 온다. 옮기면 새 녹음의 조각이 사라진다
      if (event.type !== 'recording-saved' || !this.#segmentStarts.has(event.uri)) {
        return;
      }
      this.receive(event.uri, 0);
      if (this.#segmentStarts.size === 0) {
        finish();
      }
    });
    // 로그아웃하면 그 계정의 늦은 파일을 기다리지 않는다
    const unsubscribeSignOut = this.#deps.signOutEpoch.subscribe(finish);
    const timer = setTimeout(finish, VOICE_RECORDING_LATE_WAIT_MS);
  };

  /**
   * 화면이 같은 인식기를 다시 듣기 시작했다(StrictMode·Fast Refresh로 effect가 다시 돈 경우). 앞 정리가 건 늦은 파일
   * 듣기를 거둬 같은 파일을 화면의 구독과 함께 두 번 받지 않는다. 인식기가 바뀌었으면 옛 인식기의 파일은 화면이 듣지
   * 못하므로 그 듣기는 그대로 둔다
   */
  reclaim = (subscribe: SpeechRecognizer['subscribe']): void => {
    if (this.#lateSubscribe === subscribe) {
      this.#stopLateListening?.();
    }
  };

  // 구독과 타이머만 정리하고 받기는 막지 않는다. 훅이 다시 붙으면(`reclaim`) 그 뒤의 녹음 조각도 저장해야 한다
  dispose = (): void => {
    const { draftId, recordingRepository } = this.#deps;
    this.#stopLateListening?.();
    this.#notifyArrived?.();
    // 더 기다리지 않는 파일은 놓는다. 맡아 둔 채 두면 늦게 온 파일을 다른 녹음도 받지 못한다
    for (const uri of this.#segmentStarts.keys()) {
      recordingRepository.releaseSource(uri, draftId);
    }
  };

  #take = (uri: string, startMs: number): void => {
    const { draftId, recordingRepository } = this.#deps;
    if (this.#hasDiscarded || this.#hasSignedOut()) {
      recordingRepository.removeSource(uri);
      recordingRepository.releaseSource(uri, draftId);
      return;
    }
    // 맡은 표시는 옮기기가 끝날 때 저장소가 놓는다. 그때까지 같은 파일을 뒤이어 받은 화면은 옮기려 하지 않는다
    const saving = this.#save(uri, startMs).finally(() => this.#pendingSaves.delete(saving));
    this.#pendingSaves.add(saving);
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
    if (this.#hasDiscarded || this.#hasSignedOut()) {
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

  #hasSignedOut = (): boolean => this.#deps.signOutEpoch.current() !== this.#startedEpoch;
}

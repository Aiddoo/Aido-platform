import type { SpeechRecognizer, SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { createTimerSlots } from '@src/shared/utils/create-timer-slots';

import { toSpeechStartOptions } from '../apis/speech-hint.mapper';
import { COMMON_SPEECH_HINTS } from '../constants/speech-hints.constants';
import { RECOGNIZER_END_TIMEOUT_MS } from '../constants/voice.constants';
import type { VoiceCaptureState } from '../domains/voice-capture.model';
import {
  type VoiceRecognizerLinkEvent,
  VoiceRecognizerLinkPolicy,
  createVoiceRecognizerLink,
} from '../domains/voice-recognizer-link.model';

interface VoiceRecognizerSessionPorts {
  speechRecognizer: Pick<SpeechRecognizer, 'start' | 'stop' | 'abort'>;
  /** 인식기의 시작을 아직 기다리는가. 미뤄 둔 시작은 그 사이 그만두지 않았을 때만 연다 */
  isAwaitingStart: () => boolean;
  /** 사용자가 끝내지 않은 구간을 아직 듣는가. stop에 답이 없을 때의 abort는 이때만 보낸다 */
  isListening: () => boolean;
  /** 놓을 때 끊을 듣기가 열려 있는가 */
  isActive: () => boolean;
}

/** stop 뒤 `end`를 기다리는 일. 이름 하나에 타이머 하나라 다시 걸면 앞의 것을 지운다 */
type EndWait = 'finalize' | 'deferredStart' | 'stallAbort';

/** 인식기 명령과 그리지 않는 연결 상태, `end` 대기 타이머를 React 밖에 둔다. 놓은 뒤에도 막지 않아 effect가 다시 돌아 붙은 훅이 이어 쓴다 */
export class VoiceRecognizerSession {
  readonly #ports: VoiceRecognizerSessionPorts;
  readonly #endWaits = createTimerSlots<EndWait>();
  #link = createVoiceRecognizerLink();
  #startOptions: SpeechStartOptions | null = null;

  constructor(ports: VoiceRecognizerSessionPorts) {
    this.#ports = ports;
  }

  getStartOptions = (): SpeechStartOptions | null => this.#startOptions;

  /** 다음 시작과 다시 열기에 쓸 옵션. 새로 듣기 시작하면 기능을 확인할 때까지 null로 비운다 */
  setStartOptions = (options: SpeechStartOptions | null): void => {
    this.#startOptions = options;
  };

  /** 지금 구간에 앱이 stop을 불렀다. 그 구간의 오류는 실패가 아니라 멈춤 응답일 수 있다 */
  isStopRequested = (): boolean => this.#link.isStopRequested;

  isSpeaking = (level: number, now: number): boolean =>
    VoiceRecognizerLinkPolicy.isSpeaking(this.#link, level, now);

  shouldAcceptStart = (): boolean => VoiceRecognizerLinkPolicy.shouldAcceptStart(this.#link);

  /** 앞 구간이 끝나지 않았는데 다시 열면 Android가 파일을 마무리하지 않고 버린다. `end`까지 미룬다 */
  startAfterEnd = (): void => {
    if (!this.#link.isRunning) {
      this.startDeferred();
      return;
    }
    this.#endWaits.set('deferredStart', this.startDeferred, RECOGNIZER_END_TIMEOUT_MS);
  };

  hasDeferredStart = (): boolean => this.#endWaits.has('deferredStart');

  /** 미뤄 둔 시작을 연다. 기다리는 사이 준비를 그만뒀으면 열지 않는다 */
  startDeferred = (): void => {
    this.cancelDeferredStart();
    const options = this.#startOptions;
    if (options == null || !this.#ports.isAwaitingStart()) {
      return;
    }
    this.#update({ type: 'start-requested', at: Date.now() });
    this.#open(options);
  };

  cancelDeferredStart = (): void => {
    this.#endWaits.clear('deferredStart');
  };

  /** 사용자가 끝내지 않았는데 끝난 구간을 같은 옵션으로 다시 연다. 너무 빨리 끝나기를 되풀이하거나 정한 옵션이 없어 열지 못했으면 false다 */
  restartSegment = (): boolean => {
    const options = this.#startOptions;
    const now = Date.now();
    if (options == null || VoiceRecognizerLinkPolicy.isRestartLooping(this.#link, now)) {
      return false;
    }
    this.#update({ type: 'segment-restarted', at: now });
    this.#open(options);
    return true;
  };

  /** 지금 구간을 닫는다. 그 구간의 `end`가 오면 실패가 아니라 멈춤 응답으로 본다 */
  stop = (): void => {
    this.#update({ type: 'stop-requested' });
    this.#ports.speechRecognizer.stop();
  };

  /** 구간을 닫고 `end`를 기다린다. 답이 없는 기기에서는 잠시 뒤 끝난 것으로 보고 `onUnanswered`를 부른다 */
  stopAndAwaitEnd = (onUnanswered: () => void): void => {
    this.stop();
    this.#endWaits.set('finalize', onUnanswered, RECOGNIZER_END_TIMEOUT_MS);
  };

  // abort는 바로 끝난 것으로 본다. 다음 시작은 어댑터가 abort 뒤에 차례로 처리한다
  abort = (): void => {
    this.#ports.speechRecognizer.abort();
    this.#update({ type: 'ended' });
  };

  noteStarted = (at: number): void => {
    this.#update({ type: 'started', at });
  };

  noteTextHeard = (transcript: string, at: number): void => {
    this.#update({ type: 'text-heard', transcript, at });
  };

  /** `end`를 받았다. stop의 답을 기다리던 끝내기·abort 타이머는 더 필요 없다. 미뤄 둔 시작은 부른 쪽이 연다 */
  noteEnded = (): void => {
    this.#update({ type: 'ended' });
    this.#endWaits.clear('finalize');
    this.#endWaits.clear('stallAbort');
  };

  sampleVolume = (level: number, at: number): void => {
    this.#update({ type: 'volume-sampled', level, at });
  };

  /** 파형은 움직이는데 글자가 오지 않아 구간을 다시 열 때다 */
  isStalled = (state: Pick<VoiceCaptureState, 'status'>, now: number): boolean =>
    VoiceRecognizerLinkPolicy.shouldRestartStalledRecognizer(this.#link, state, now);

  /** 멈춘 인식기는 stop에 답하지 않을 수 있어 잠시 뒤 abort로 end를 받고, 곧바로 새로 열면 Android가 파일을 버려 그 end 뒤에 연다 */
  closeStalledSegment = (now: number): void => {
    this.#update({ type: 'stall-restarted', at: now });
    this.stop();
    this.#endWaits.set(
      'stallAbort',
      () => {
        if (this.#ports.isListening()) {
          this.#ports.speechRecognizer.abort();
        }
      },
      RECOGNIZER_END_TIMEOUT_MS,
    );
  };

  cancelEndWaits = (): void => {
    this.#endWaits.clearAll();
  };

  /** 타이머를 지우고 듣던 구간이 있으면 끊는다. 명령과 이벤트는 막지 않아 다시 붙은 훅이 이어 쓴다 */
  dispose = (): void => {
    this.cancelEndWaits();
    if (this.#ports.isActive()) {
      this.#ports.speechRecognizer.abort();
    }
  };

  #update = (event: VoiceRecognizerLinkEvent): void => {
    this.#link = VoiceRecognizerLinkPolicy.reduceRecognizerLink(this.#link, event);
  };

  #open = (options: SpeechStartOptions): void => {
    this.#ports.speechRecognizer.start(
      toSpeechStartOptions(options, COMMON_SPEECH_HINTS[options.locale]),
    );
  };
}

import { useHaptics, useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type {
  SpeechErrorCode,
  SpeechLocale,
  SpeechMode,
  SpeechStartOptions,
} from '@src/core/ports/speech-recognizer';
import { noop } from 'es-toolkit';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import {
  AUTO_FINISH_SILENCE_MS,
  QUICK_CAPTURE_MAX_SECONDS,
  VOICE_NO_VOLUME_GAP_MS,
  VOICE_PREPARING_TIMEOUT_MS,
} from '../constants/voice.constants';
import type { VoiceCaptureEntry } from '../constants/voice.events';
import {
  createVoiceCaptureState,
  reduceVoiceCapture,
  type VoiceCaptureEvent,
  type VoiceCaptureSeed,
  VoiceCapturePolicy,
} from '../domains/voice-capture.model';
import {
  createVoiceRecognizerLink,
  reduceRecognizerLink,
  type VoiceRecognizerLinkEvent,
  VoiceRecognizerLinkPolicy,
} from '../domains/voice-recognizer-link.model';
import { VoiceTranscriptPolicy } from '../domains/voice-transcript.model';
import {
  type CapturedPlan,
  type VoiceCaptureState,
  type VoicePauseCause,
} from '../schemas/voice-capture.schema';
import { type VoiceTranscript } from '../schemas/voice-transcript.schema';
import { toCaptureOutcome } from '../utils/voice-analytics';
import { useSpeechEvent } from './use-speech-event';
import { useVoiceCaptureTelemetry } from './use-voice-capture-telemetry';

/** 인식기가 stop 뒤에 end를 주지 않는 기기를 위한 안전 시간. 끝내기·이어 듣기가 함께 쓴다 */
const FINALIZE_TIMEOUT_MS = 1_500;

interface UseVoiceCaptureSessionOptions {
  entry: VoiceCaptureEntry;
  /** `quick`은 말이 멈추면 알아서 끝내고, `note`는 사용자가 끝낼 때까지 듣는다 */
  mode?: Extract<SpeechMode, 'quick' | 'note'>;
  /** 한 번에 들을 수 있는 길이(초). null이면 끝이 없다 */
  maxSeconds?: number | null;
  /** 길이 한도에 닿았을 때. 없으면 바로 끝낸다 */
  onLimitReached?: () => void;
  /**
   * 캡처가 끝나 글자가 모였을 때 부른다. 계획을 돌려주면 고르는 단계로, null이면 처음으로 돌아간다.
   * 거절하면 들은 글자를 남긴 채 실패 상태가 된다.
   */
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
  /**
   * 실패 상태가 그려지기 전에 부른다. 글자를 입력 칸으로 옮기면 빈 칸이 먼저 보이지 않는다.
   * 렌더 뒤의 effect에서 옮기면 Android에서 칸이 잠깐 비어 보인다.
   */
  onFailed?: (transcript: VoiceTranscript) => void;
}

export interface BeginOptions {
  locale: SpeechLocale;
  contextualStrings: readonly string[];
  recordingDirectory?: string | null;
  seed?: VoiceCaptureSeed;
}

/**
 * 말하기 인식 세션. 화면이 아니라 이 훅을 쓴 시트가 세션을 소유하므로 회전·레이아웃 변화로 끊기지 않는다.
 * 앱이 백그라운드로 가면 지금까지의 글자를 확정하고 멈춰서 돌아왔을 때 이어 들을 수 있게 둔다.
 */
export function useVoiceCaptureSession({
  entry,
  mode = 'quick',
  maxSeconds = QUICK_CAPTURE_MAX_SECONDS,
  onLimitReached,
  onCaptured,
  onFailed,
}: UseVoiceCaptureSessionOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const haptics = useHaptics();
  const telemetry = useVoiceCaptureTelemetry({ entry, mode });

  const [state, setState] = useState<VoiceCaptureState>(createVoiceCaptureState);
  const level = useSharedValue(0);
  const stateRef = useRef(state);
  const startOptionsRef = useRef<SpeechStartOptions | null>(null);
  const [timers] = useState(() =>
    createTimerSlots<'finalize' | 'deferredStart' | 'stallRestart'>(),
  );
  const linkRef = useRef(createVoiceRecognizerLink());
  /** 화면이 내려간 뒤에 끝난 비동기 확인이 인식기를 다시 켜면 아무도 끄지 못한다 */
  const isUnmountedRef = useRef(false);

  const dispatch = useCallback((event: VoiceCaptureEvent) => {
    const previous = stateRef.current;
    const next = reduceVoiceCapture(previous, event);
    if (next !== previous) {
      stateRef.current = next;
      setState(next);
    }
    return { previous, next };
  }, []);

  const updateLink = (event: VoiceRecognizerLinkEvent) => {
    linkRef.current = reduceRecognizerLink(linkRef.current, event);
  };

  const getStatus = () => stateRef.current.status;

  const stopRecognizer = () => {
    updateLink({ type: 'stop-requested' });
    speechRecognizer.stop();
  };

  const silence = useSilenceAutoFinish({
    isEnabled: mode === 'quick',
    canFinish: () => VoiceCapturePolicy.canFinish(stateRef.current),
    onSilence: () => {
      if (VoiceCapturePolicy.shouldAutoFinish(stateRef.current, AUTO_FINISH_SILENCE_MS)) {
        finish();
      }
    },
    onVolumeGap: () => level.set(0),
  });

  const clearTimers = () => {
    silence.clear();
    level.set(0);
    timers.clearAll();
  };

  const handleFinalized = () => {
    timers.clear('finalize');
    const { next } = dispatch({ type: 'end' });
    telemetry.finished(toCaptureOutcome(next), next);
  };

  function finish() {
    silence.cancelQuiet();
    timers.clear('deferredStart');
    const { previous, next } = dispatch({ type: 'finish', at: Date.now() });
    if (previous === next) {
      return;
    }
    if (next.status === 'finalizing') {
      stopRecognizer();
      timers.set('finalize', handleFinalized, FINALIZE_TIMEOUT_MS);
      return;
    }
    telemetry.finished(toCaptureOutcome(next), next);
  }

  const handleError = (code: SpeechErrorCode) => {
    const { isStopRequested } = linkRef.current;
    const { previous, next } = dispatch({ type: 'error', code, at: Date.now(), isStopRequested });
    const isOnDevice = startOptionsRef.current?.isOnDevice;

    if (VoiceCapturePolicy.isRecognizerFailure(previous, code, isStopRequested)) {
      telemetry.recognizerFailed(code, isOnDevice);
    } else {
      telemetry.recognizerStopped(code, isOnDevice);
    }

    if (next.status === 'failed') {
      onFailed?.(next.transcript);
      clearTimers();
      haptics.notify('error');
      telemetry.failed(next.reason);
      return;
    }
    if (next.status === 'paused' && previous.status !== 'paused') {
      clearTimers();
      telemetry.paused('interrupted');
    }
  };

  const restartSegment = () => {
    const startOptions = startOptionsRef.current;
    if (startOptions == null) {
      return;
    }
    const now = Date.now();
    if (VoiceRecognizerLinkPolicy.isRestartLooping(linkRef.current, now)) {
      handleError('client');
      return;
    }
    updateLink({ type: 'segment-restarted', at: now });
    speechRecognizer.start(startOptions);
  };

  /**
   * 파형은 움직이는데 글자가 오지 않는 세션을 닫고 이어 듣는다. 일시정지·이어 듣기와 같은 길이고 사용자는 할 일이 없다.
   * 듣던 글자는 `end`가 확정한다. 멈춘 인식기는 stop에 답하지 않을 수 있어 잠시 뒤 abort로 `end`를 받는다.
   * abort는 녹음 파일을 마무리하지만 바로 새로 시작하면 Android가 파일을 버린다.
   */
  const restartStalledRecognizer = (now: number) => {
    updateLink({ type: 'stall-restarted', at: now });
    telemetry.stalled(startOptionsRef.current?.isOnDevice ?? false);
    stopRecognizer();
    timers.set(
      'stallRestart',
      () => {
        if (VoiceCapturePolicy.shouldRestartSegment(stateRef.current)) {
          speechRecognizer.abort();
        }
      },
      FINALIZE_TIMEOUT_MS,
    );
  };

  const watchRecognizerStall = (nextLevel: number) => {
    const now = Date.now();
    updateLink({ type: 'volume-sampled', level: nextLevel, at: now });
    const { isStopRequested, stallWatch } = linkRef.current;
    if (
      !isStopRequested &&
      VoiceRecognizerLinkPolicy.shouldRestartStalledRecognizer(stateRef.current, stallWatch, now)
    ) {
      restartStalledRecognizer(now);
    }
  };

  /** 앞 구간이 끝나지 않았는데 다시 열면 Android가 파일을 마무리하지 않고 버린다. `end`까지 미룬다 */
  const startAfterRecognizerEnds = () => {
    if (!linkRef.current.isRunning) {
      startPrepared();
      return;
    }
    timers.set('deferredStart', startPrepared, FINALIZE_TIMEOUT_MS);
  };

  function startPrepared() {
    timers.clear('deferredStart');
    const startOptions = startOptionsRef.current;
    if (startOptions == null || getStatus() !== 'preparing') {
      return;
    }
    updateLink({ type: 'start-requested', at: Date.now() });
    speechRecognizer.start(startOptions);
  }

  useSpeechEvent((event) => {
    if (event.type === 'end') {
      updateLink({ type: 'ended' });
      timers.clear('stallRestart');
    }
    if (!VoiceCapturePolicy.isActive(stateRef.current)) {
      return;
    }
    match(event)
      .with({ type: 'start' }, () => {
        const now = Date.now();
        dispatch({ type: 'start', at: now });
        updateLink({ type: 'started', at: now });
        // 준비 중에는 멈출 수 없어 백그라운드 전환이 무시된다. 뒤늦은 시작 신호로 몰래 듣지 않는다
        if (AppState.currentState === 'background') {
          pause('app-background');
        }
      })
      .with({ type: 'result' }, ({ transcript, isFinal }) => {
        dispatch({ type: 'result', result: { transcript, isFinal } });
        if (transcript.trim().length > 0) {
          updateLink({ type: 'text-heard', transcript, at: Date.now() });
          silence.cancelQuiet();
        }
      })
      .with({ type: 'volume' }, ({ level: nextLevel }) => {
        level.set(nextLevel);
        silence.noteVolume(
          VoiceCapturePolicy.isSpeaking(nextLevel, linkRef.current.lastTextAt, Date.now()),
        );
        watchRecognizerStall(nextLevel);
      })
      .with({ type: 'error' }, ({ code }) => handleError(code))
      .with({ type: 'end' }, () => {
        const current = stateRef.current;
        if (timers.has('deferredStart')) {
          startPrepared();
        } else if (VoiceCapturePolicy.shouldRestartSegment(current)) {
          dispatch({ type: 'end' });
          restartSegment();
        } else if (current.status === 'finalizing') {
          handleFinalized();
        }
      })
      .with({ type: 'no-match' }, { type: 'recording-started' }, { type: 'recording-saved' }, noop)
      .exhaustive();
  });

  const pause = (cause: VoicePauseCause) => {
    const { previous, next } = dispatch({ type: 'pause', cause, at: Date.now() });
    if (previous === next) {
      return;
    }
    clearTimers();
    stopRecognizer();
    telemetry.paused(cause);
  };

  const pauseForBackground = useEffectEvent(() => pause('app-background'));

  useEffect(() => {
    isUnmountedRef.current = false;
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        pauseForBackground();
      }
    });

    return () => {
      isUnmountedRef.current = true;
      appStateSubscription.remove();
      clearTimers();
      if (VoiceCapturePolicy.isActive(stateRef.current)) {
        speechRecognizer.abort();
      }
    };
  }, [speechRecognizer]);

  useTimeoutWhile(
    state.status === 'listening',
    () =>
      maxSeconds == null
        ? null
        : VoiceCapturePolicy.getRemainingCaptureMs(stateRef.current, maxSeconds, Date.now()),
    () => {
      if (onLimitReached == null) {
        finish();
        return;
      }
      pause('limit');
      onLimitReached();
    },
    maxSeconds,
  );

  const runCaptured = useEffectEvent((transcript: string) => onCaptured(transcript));
  const notifyPlanFailed = useEffectEvent((transcript: VoiceTranscript) => onFailed?.(transcript));
  const isPlanning = state.status === 'planning';
  useEffect(() => {
    if (!isPlanning) {
      return;
    }
    let isCurrent = true;
    const text = VoiceTranscriptPolicy.getTranscriptText(stateRef.current.transcript);
    telemetry.planRequested();
    runCaptured(text)
      .then((result) => {
        if (isCurrent) {
          dispatch({ type: 'planned', result });
        }
      })
      .catch(() => {
        if (isCurrent) {
          const { next } = dispatch({ type: 'plan-failed' });
          notifyPlanFailed(next.transcript);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isPlanning, dispatch]);

  // 시작 신호가 오지 않으면 듣는 중처럼 멈춰 있지 않고 글자를 든 실패 상태로 간다
  useTimeoutWhile(
    state.status === 'preparing',
    () => VOICE_PREPARING_TIMEOUT_MS,
    () => {
      speechRecognizer.abort();
      updateLink({ type: 'ended' });
      handleError('client');
    },
  );

  /** 권한·동의·한도 확인을 마친 뒤 부른다. 시작했으면 true다 */
  const begin = async ({
    locale,
    contextualStrings,
    recordingDirectory = null,
    seed,
  }: BeginOptions): Promise<boolean> => {
    if (isUnmountedRef.current || getStatus() !== 'idle') {
      return false;
    }
    dispatch({ type: 'prepare', seed });
    try {
      const capabilities = await speechRecognizer.getCapabilities(locale, mode);
      if (isUnmountedRef.current || getStatus() !== 'preparing') {
        return false;
      }
      if (!capabilities.isAvailable) {
        handleError('service-not-allowed');
        return false;
      }
      const isOnDevice = capabilities.canRecognizeOnDevice;
      startOptionsRef.current = {
        locale,
        mode,
        contextualStrings,
        isOnDevice,
        recordingDirectory,
      };
      startAfterRecognizerEnds();
      haptics.impact('light');
      telemetry.started(locale, isOnDevice);
      return true;
    } catch (error) {
      if (isUnmountedRef.current) {
        return false;
      }
      telemetry.capabilityCheckFailed(error);
      handleError('unknown');
      return false;
    }
  };

  const resume = () => {
    const { previous, next } = dispatch({ type: 'resume' });
    if (previous === next || startOptionsRef.current == null) {
      return;
    }
    startAfterRecognizerEnds();
    if (previous.status === 'paused') {
      telemetry.resumed(previous.cause);
    }
  };

  const reset = (outcome: 'cancelled' | 'upgraded') => {
    const previous = stateRef.current;
    clearTimers();
    dispatch({ type: 'cancel' });
    if (VoiceCapturePolicy.isActive(previous)) {
      speechRecognizer.abort();
      // abort는 바로 끝난 것으로 본다. 다음 시작은 어댑터가 abort 뒤에 차례로 처리한다
      updateLink({ type: 'ended' });
    }
    if (previous.status !== 'idle' && previous.status !== 'review') {
      telemetry.finished(
        VoiceTranscriptPolicy.isTranscriptEmpty(previous.transcript) ? 'empty' : outcome,
        previous,
      );
    }
  };

  const cancel = () => reset('cancelled');
  /** 들은 글자를 말로 메모하기로 넘겼다. 취소와 달리 이어 가는 것이라 따로 남긴다 */
  const handOff = () => reset('upgraded');

  const retryPlanning = () => {
    dispatch({ type: 'retry-plan' });
  };

  const changeLocale = async (locale: SpeechLocale) => {
    const startOptions = startOptionsRef.current;
    if (startOptions == null || startOptions.locale === locale) {
      return;
    }
    const { canRecognizeOnDevice } = await speechRecognizer.getCapabilities(locale, mode);
    if (isUnmountedRef.current) {
      return;
    }
    startOptionsRef.current = { ...startOptions, locale, isOnDevice: canRecognizeOnDevice };
    if (VoiceCapturePolicy.isActive(stateRef.current)) {
      telemetry.localeChanged(locale, canRecognizeOnDevice);
    }
    if (getStatus() === 'listening') {
      stopRecognizer();
    }
  };

  const getElapsedMs = () => VoiceCapturePolicy.getElapsedMs(stateRef.current, Date.now());

  return {
    state,
    level,
    isQuiet: silence.isQuiet,
    begin,
    finish,
    pause: () => pause('user'),
    interrupt: () => pause('interrupted'),
    resume,
    cancel,
    handOff,
    retryPlanning,
    changeLocale,
    getElapsedMs,
  };
}

/** 이름 하나에 타이머 하나. 다시 걸면 앞의 것을 지운다 */
function createTimerSlots<TKey extends string>() {
  const slots = new Map<TKey, ReturnType<typeof setTimeout>>();

  const clear = (key: TKey) => {
    const timer = slots.get(key);
    if (timer != null) {
      clearTimeout(timer);
      slots.delete(key);
    }
  };

  return {
    set: (key: TKey, callback: () => void, delayMs: number) => {
      clear(key);
      slots.set(
        key,
        setTimeout(() => {
          slots.delete(key);
          callback();
        }, delayMs),
      );
    },
    clear,
    has: (key: TKey) => slots.has(key),
    clearAll: () => {
      slots.forEach((timer) => clearTimeout(timer));
      slots.clear();
    },
  };
}

interface UseSilenceAutoFinishOptions {
  isEnabled: boolean;
  canFinish: () => boolean;
  /** 말이 멈춘 채 `AUTO_FINISH_SILENCE_MS`가 지났다 */
  onSilence: () => void;
  /** 음량 이벤트가 끊겼다. `isEnabled`와 상관없이 부른다 */
  onVolumeGap: () => void;
}

/** 말이 멈춘 것을 음량과 글자로 판단해 잠시 뒤 알린다 */
function useSilenceAutoFinish({
  isEnabled,
  canFinish,
  onSilence,
  onVolumeGap,
}: UseSilenceAutoFinishOptions) {
  const [isQuiet, setIsQuiet] = useState(false);
  const isQuietRef = useRef(false);
  const [timers] = useState(() => createTimerSlots<'quiet' | 'volumeGap'>());

  const cancelQuiet = () => {
    timers.clear('quiet');
    if (isQuietRef.current) {
      isQuietRef.current = false;
      setIsQuiet(false);
    }
  };

  const markSilence = () => {
    if (!isEnabled || isQuietRef.current || !canFinish()) {
      return;
    }
    isQuietRef.current = true;
    setIsQuiet(true);
    timers.set('quiet', onSilence, AUTO_FINISH_SILENCE_MS);
  };

  const noteVolume = (isSpeaking: boolean) => {
    timers.set(
      'volumeGap',
      () => {
        onVolumeGap();
        markSilence();
      },
      VOICE_NO_VOLUME_GAP_MS,
    );
    if (isSpeaking) {
      cancelQuiet();
    } else {
      markSilence();
    }
  };

  return {
    isQuiet,
    noteVolume,
    cancelQuiet,
    clear: () => {
      cancelQuiet();
      timers.clear('volumeGap');
    },
  };
}

/** `isActive`인 동안 시간이 지나면 한 번 부른다. `restartKey`가 바뀌면 다시 잰다. 지연이 null이면 걸지 않는다 */
function useTimeoutWhile(
  isActive: boolean,
  getDelayMs: () => number | null,
  onTimeout: () => void,
  restartKey?: number | null,
) {
  const readDelayMs = useEffectEvent(getDelayMs);
  const handleTimeout = useEffectEvent(onTimeout);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const delayMs = readDelayMs();
    if (delayMs == null) {
      return;
    }
    const timer = setTimeout(() => handleTimeout(), delayMs);

    return () => clearTimeout(timer);
  }, [isActive, restartKey]);
}

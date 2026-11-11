import {
  useAppLifecycle,
  useHaptics,
  useSpeechRecognizer,
} from '@src/bootstrap/providers/di-context';
import type {
  SpeechErrorCode,
  SpeechLocale,
  SpeechMode,
  SpeechStartOptions,
} from '@src/core/ports/speech-recognizer';
import { noop } from 'es-toolkit';
import { type RefObject, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
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
  type VoiceCaptureEvent,
  VoiceCapturePolicy,
  type VoiceCaptureSeed,
  type CapturedPlan,
  type VoiceCaptureState,
  type VoicePauseCause,
  createVoiceCaptureState,
} from '../domains/voice-capture.model';
import {
  type VoiceRecognizerLinkEvent,
  VoiceRecognizerLinkPolicy,
  createVoiceRecognizerLink,
} from '../domains/voice-recognizer-link.model';
import { VoiceTranscriptPolicy, type VoiceTranscript } from '../domains/voice-transcript.model';
import { getRecognizerStartOptions } from '../utils/speech-context';
import { toCaptureOutcome } from '../utils/voice-analytics';
import { useSpeechEvent } from './use-speech-event';
import { useVoiceCaptureTelemetry } from './use-voice-capture-telemetry';

/** 인식기가 stop 뒤에 end를 주지 않는 기기를 위한 안전 시간. 끝내기·이어 듣기·멈춤 복구가 함께 쓴다 */
const FINALIZE_TIMEOUT_MS = 1_500;

interface UseVoiceCaptureSessionOptions {
  entry: VoiceCaptureEntry;
  /** `quick`은 말이 멈추면 알아서 끝내고, `note`는 사용자가 끝낼 때까지 듣는다 */
  mode?: Extract<SpeechMode, 'quick' | 'note'>;
  /** 한 번에 들을 수 있는 길이(초). null이면 끝이 없다 */
  maxSeconds?: number | null;
  /** 길이 한도에 닿았을 때. 없으면 바로 끝낸다 */
  onLimitReached?: () => void;
  /** 계획을 돌려주면 고르는 단계, null이면 처음으로 간다. 거절하면 글자를 남긴 채 실패 상태다 */
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
  /** 실패 상태를 그리기 전에 부른다. 렌더 뒤 effect에서 옮기면 Android에서 칸이 잠깐 비어 보인다 */
  onFailed?: (transcript: VoiceTranscript) => void;
}

export interface BeginOptions {
  locale: SpeechLocale;
  hintWords: readonly string[];
  recordingDirectory?: string | null;
  seed?: VoiceCaptureSeed;
}

/** 시트가 세션을 소유해 회전에도 끊기지 않고, 백그라운드로 가면 글자를 확정하고 멈춰 이어 들을 수 있게 둔다 */
export function useVoiceCaptureSession({
  entry,
  mode = 'quick',
  maxSeconds = QUICK_CAPTURE_MAX_SECONDS,
  onLimitReached,
  onCaptured,
  onFailed,
}: UseVoiceCaptureSessionOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const appLifecycle = useAppLifecycle();
  const haptics = useHaptics();
  const telemetry = useVoiceCaptureTelemetry({ entry, mode });

  const { state, stateRef, dispatch } = useVoiceCaptureState();
  const recognizer = useRecognizerLink();
  const level = useSharedValue(0);
  const startOptionsRef = useRef<SpeechStartOptions | null>(null);
  const [timers] = useState(() => createTimerSlots<'finalize' | 'deferredStart'>());

  const getStatus = () => stateRef.current.status;

  const silence = useSilenceAutoFinish({
    isEnabled: mode === 'quick',
    canFinish: () => VoiceCapturePolicy.canFinish(stateRef.current),
    onSilence: (silentMs) => {
      if (VoiceCapturePolicy.shouldAutoFinish(stateRef.current, silentMs, AUTO_FINISH_SILENCE_MS)) {
        finish();
      }
    },
    onVolumeGap: () => level.set(0),
  });

  const stall = useRecognizerStallRecovery({
    stateRef,
    recognizer,
    onStalled: () => telemetry.stalled(startOptionsRef.current?.isOnDevice ?? false),
  });

  const clearTimers = () => {
    silence.clear();
    stall.clear();
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
      recognizer.stop();
      timers.set('finalize', handleFinalized, FINALIZE_TIMEOUT_MS);
      return;
    }
    telemetry.finished(toCaptureOutcome(next), next);
  }

  const handleError = (code: SpeechErrorCode) => {
    const { isStopRequested } = recognizer.linkRef.current;
    const { previous, next } = dispatch({ type: 'error', code, at: Date.now(), isStopRequested });
    const isOnDevice = startOptionsRef.current?.isOnDevice;

    if (VoiceCapturePolicy.isRecognizerFailure(previous, { code, isStopRequested })) {
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

  const pause = (cause: VoicePauseCause) => {
    const { previous, next } = dispatch({ type: 'pause', cause, at: Date.now() });
    if (previous === next) {
      return;
    }
    clearTimers();
    recognizer.stop();
    telemetry.paused(cause);
  };

  const restartSegment = () => {
    const startOptions = startOptionsRef.current;
    if (startOptions == null) {
      return;
    }
    if (!recognizer.restartSegment(startOptions)) {
      handleError('client');
    }
  };

  /** 앞 구간이 끝나지 않았는데 다시 열면 Android가 파일을 마무리하지 않고 버린다. `end`까지 미룬다 */
  const startAfterRecognizerEnds = () => {
    if (!recognizer.linkRef.current.isRunning) {
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
    recognizer.start(startOptions);
  }

  useSpeechEvent((event) => {
    if (event.type === 'end') {
      recognizer.update({ type: 'ended' });
      stall.clear();
    }
    if (!VoiceCapturePolicy.isActive(stateRef.current)) {
      return;
    }
    match(event)
      .with({ type: 'start' }, () => {
        const now = Date.now();
        dispatch({ type: 'start', at: now });
        recognizer.update({ type: 'started', at: now });
        // 준비 중에는 멈출 수 없어 백그라운드 전환이 무시된다. 뒤늦은 시작 신호로 몰래 듣지 않는다
        if (appLifecycle.getCurrentState() === 'background') {
          pause('app-background');
        }
      })
      .with({ type: 'result' }, ({ transcript, isFinal }) => {
        dispatch({ type: 'result', result: { transcript, isFinal } });
        if (transcript.trim().length > 0) {
          recognizer.update({ type: 'text-heard', transcript, at: Date.now() });
          silence.cancelQuiet();
        }
      })
      .with({ type: 'volume' }, ({ level: nextLevel }) => {
        level.set(nextLevel);
        silence.noteVolume(
          VoiceRecognizerLinkPolicy.isSpeaking(recognizer.linkRef.current, nextLevel, Date.now()),
        );
        stall.sampleVolume(nextLevel);
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

  usePauseOnBackground(() => pause('app-background'));
  // 인식기 이벤트 구독을 먼저 푼 뒤에 끊어야 abort가 보낸 `end`가 내려가는 화면의 상태를 바꾸지 않는다
  const isUnmountedRef = useReleaseOnUnmount(() => {
    clearTimers();
    if (VoiceCapturePolicy.isActive(stateRef.current)) {
      speechRecognizer.abort();
    }
  });

  useTimeoutWhile({
    isActive: state.status === 'listening',
    getDelayMs: () =>
      maxSeconds == null
        ? null
        : VoiceCapturePolicy.getRemainingCaptureMs(stateRef.current, maxSeconds, Date.now()),
    onTimeout: () => {
      if (onLimitReached == null) {
        finish();
        return;
      }
      pause('limit');
      onLimitReached();
    },
    restartKey: maxSeconds,
  });

  useCapturePlanning({
    isPlanning: state.status === 'planning',
    stateRef,
    dispatch,
    onCaptured,
    onFailed,
    onRequested: () => telemetry.planRequested(),
  });

  // 시작 신호가 오지 않으면 듣는 중처럼 멈춰 있지 않고 글자를 든 실패 상태로 간다
  useTimeoutWhile({
    isActive: state.status === 'preparing',
    getDelayMs: () => VOICE_PREPARING_TIMEOUT_MS,
    onTimeout: () => {
      speechRecognizer.abort();
      recognizer.update({ type: 'ended' });
      handleError('client');
    },
  });

  /** 권한·동의·한도 확인을 마친 뒤 부른다. 시작했으면 true다 */
  const begin = async ({
    locale,
    hintWords,
    recordingDirectory = null,
    seed,
  }: BeginOptions): Promise<boolean> => {
    if (isUnmountedRef.current || getStatus() !== 'idle') {
      return false;
    }
    dispatch({ type: 'prepare', seed });
    try {
      const capabilities = await speechRecognizer.getCapabilities(mode, locale);
      if (isUnmountedRef.current || getStatus() !== 'preparing') {
        return false;
      }
      const isOnDevice = capabilities.canRecognizeOnDevice;
      startOptionsRef.current = {
        locale,
        mode,
        hintWords,
        isOnDevice,
        recordingDirectory,
      };
      if (!capabilities.isAvailable) {
        handleError('service-not-allowed');
        return false;
      }
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
    if (startOptionsRef.current == null) {
      return;
    }
    const { previous, next } = dispatch({ type: 'resume' });
    if (previous === next) {
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
      recognizer.update({ type: 'ended' });
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
    const { canRecognizeOnDevice } = await speechRecognizer.getCapabilities(mode, locale);
    if (isUnmountedRef.current) {
      return;
    }
    startOptionsRef.current = { ...startOptions, locale, isOnDevice: canRecognizeOnDevice };
    if (VoiceCapturePolicy.isActive(stateRef.current)) {
      telemetry.localeChanged(locale, canRecognizeOnDevice);
    }
    if (getStatus() === 'listening') {
      recognizer.stop();
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

/** 인식기 이벤트는 렌더를 기다리지 않고 다음 상태를 읽어야 한다. dispatch는 바뀌지 않았으면 같은 객체다 */
function useVoiceCaptureState() {
  const [state, setState] = useState<VoiceCaptureState>(createVoiceCaptureState);
  const stateRef = useRef(state);

  const dispatch = useCallback((event: VoiceCaptureEvent) => {
    const previous = stateRef.current;
    const next = VoiceCapturePolicy.reduceVoiceCapture(previous, event);
    if (next !== previous) {
      stateRef.current = next;
      setState(next);
    }
    return { previous, next };
  }, []);

  return { state, stateRef, dispatch };
}

type VoiceCaptureDispatch = ReturnType<typeof useVoiceCaptureState>['dispatch'];

/** 연결은 그리지 않는 값이라 ref에 두고 VoiceRecognizerLinkPolicy로만 바꾼다 */
function useRecognizerLink() {
  const speechRecognizer = useSpeechRecognizer();
  const linkRef = useRef(createVoiceRecognizerLink());

  const update = (event: VoiceRecognizerLinkEvent) => {
    linkRef.current = VoiceRecognizerLinkPolicy.reduceRecognizerLink(linkRef.current, event);
  };

  const start = (options: SpeechStartOptions) => {
    update({ type: 'start-requested', at: Date.now() });
    speechRecognizer.start(getRecognizerStartOptions(options));
  };

  return {
    linkRef,
    update,
    start,
    /** 사용자가 끝내지 않았는데 끝난 구간을 같은 옵션으로 다시 연다. 너무 빨리 끝나기를 되풀이하면 열지 않고 false다 */
    restartSegment: (options: SpeechStartOptions) => {
      const now = Date.now();
      if (VoiceRecognizerLinkPolicy.isRestartLooping(linkRef.current, now)) {
        return false;
      }
      update({ type: 'segment-restarted', at: now });
      speechRecognizer.start(getRecognizerStartOptions(options));
      return true;
    },
    /** 지금 구간을 닫는다. 그 구간의 `end`가 오면 실패가 아니라 멈춤 응답으로 본다 */
    stop: () => {
      update({ type: 'stop-requested' });
      speechRecognizer.stop();
    },
  };
}

type RecognizerLink = ReturnType<typeof useRecognizerLink>;

interface UseRecognizerStallRecoveryOptions {
  stateRef: RefObject<VoiceCaptureState>;
  recognizer: RecognizerLink;
  onStalled: () => void;
}

/** 멈춘 인식기는 stop에 답하지 않을 수 있어 잠시 뒤 abort로 end를 받고, 곧바로 새로 열면 Android가 파일을 버린다 */
function useRecognizerStallRecovery({
  stateRef,
  recognizer,
  onStalled,
}: UseRecognizerStallRecoveryOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const [timers] = useState(() => createTimerSlots<'stallRestart'>());

  const restartStalledRecognizer = (now: number) => {
    recognizer.update({ type: 'stall-restarted', at: now });
    onStalled();
    recognizer.stop();
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

  return {
    sampleVolume: (level: number) => {
      const now = Date.now();
      recognizer.update({ type: 'volume-sampled', level, at: now });
      if (
        VoiceRecognizerLinkPolicy.shouldRestartStalledRecognizer(
          recognizer.linkRef.current,
          stateRef.current,
          now,
        )
      ) {
        restartStalledRecognizer(now);
      }
    },
    clear: () => timers.clear('stallRestart'),
  };
}

interface UseSilenceAutoFinishOptions {
  isEnabled: boolean;
  canFinish: () => boolean;
  /** 말이 멈춘 채 `AUTO_FINISH_SILENCE_MS`가 지났다. 실제로 멈춘 시간을 넘긴다 */
  onSilence: (silentMs: number) => void;
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
    const quietSince = Date.now();
    timers.set('quiet', () => onSilence(Date.now() - quietSince), AUTO_FINISH_SILENCE_MS);
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

/** 돌려주는 ref는 내려간 뒤 끝난 비동기 확인이 인식기를 다시 켜지 못하게 막는다. 켜면 아무도 끄지 못한다 */
function useReleaseOnUnmount(release: () => void) {
  const isUnmountedRef = useRef(false);
  const releaseOnUnmount = useEffectEvent(release);

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
      releaseOnUnmount();
    };
  }, []);

  return isUnmountedRef;
}

/** 앱이 백그라운드로 넘어갈 때마다 가장 최근 `onBackground`를 부른다 */
function usePauseOnBackground(onBackground: () => void) {
  const appLifecycle = useAppLifecycle();
  const handleBackground = useEffectEvent(onBackground);

  useEffect(
    () =>
      appLifecycle.subscribe((nextState) => {
        if (nextState === 'background') {
          handleBackground();
        }
      }),
    [appLifecycle],
  );
}

interface UseCapturePlanningOptions {
  isPlanning: boolean;
  stateRef: RefObject<VoiceCaptureState>;
  dispatch: VoiceCaptureDispatch;
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
  onFailed?: (transcript: VoiceTranscript) => void;
  onRequested: () => void;
}

/** 결과가 오기 전에 계획 단계를 떠났으면(취소·다시 시도) 그 결과는 버린다 */
function useCapturePlanning({
  isPlanning,
  stateRef,
  dispatch,
  onCaptured,
  onFailed,
  onRequested,
}: UseCapturePlanningOptions) {
  const runCaptured = useEffectEvent((transcript: string) => onCaptured(transcript));
  const notifyPlanFailed = useEffectEvent((transcript: VoiceTranscript) => onFailed?.(transcript));
  const trackPlanRequested = useEffectEvent(onRequested);

  useEffect(() => {
    if (!isPlanning) {
      return;
    }
    const planning = new AbortController();
    const text = VoiceTranscriptPolicy.getTranscriptText(stateRef.current.transcript);
    trackPlanRequested();
    runCaptured(text)
      .then((result) => {
        if (!planning.signal.aborted) {
          dispatch({ type: 'planned', result });
        }
      })
      .catch(() => {
        if (!planning.signal.aborted) {
          const { next } = dispatch({ type: 'plan-failed' });
          notifyPlanFailed(next.transcript);
        }
      });

    return () => planning.abort();
  }, [isPlanning, stateRef, dispatch]);
}

/** `isActive`인 동안 시간이 지나면 한 번 부른다. `restartKey`가 바뀌면 다시 잰다. 지연이 null이면 걸지 않는다 */
function useTimeoutWhile({
  isActive,
  getDelayMs,
  onTimeout,
  restartKey,
}: {
  isActive: boolean;
  getDelayMs: () => number | null;
  onTimeout: () => void;
  restartKey?: number | null;
}) {
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

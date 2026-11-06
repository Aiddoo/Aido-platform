import {
  useErrorReporter,
  useHaptics,
  useLogger,
  useSpeechRecognizer,
} from '@src/bootstrap/providers/di-context';
import type {
  SpeechErrorCode,
  SpeechEvent,
  SpeechLocale,
  SpeechMode,
  SpeechStartOptions,
} from '@src/core/ports/speech-recognizer';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import type {
  VoiceCaptureEntry,
  VoiceCaptureOutcome,
} from '@src/shared/observability/telemetry-keys';
import { noop } from 'es-toolkit';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import {
  AUTO_FINISH_SILENCE_MS,
  QUICK_CAPTURE_MAX_SECONDS,
  VOICE_NO_VOLUME_GAP_MS,
  VOICE_PREPARING_TIMEOUT_MS,
} from '../constants/voice.constants';
import {
  type CapturedPlan,
  createVoiceCaptureState,
  createVoiceRecognizerLink,
  reduceRecognizerLink,
  reduceVoiceCapture,
  type VoiceCaptureEvent,
  type VoiceCaptureSeed,
  VoiceCapturePolicy,
  type VoiceCaptureState,
  type VoicePauseCause,
  type VoiceRecognizerLinkEvent,
} from '../domains/voice-capture.model';
import { type VoiceTranscript, VoiceTranscriptPolicy } from '../domains/voice-transcript.model';
import { getDurationBucket } from '../utils/analytics/duration-bucket';

/** 인식기가 stop 뒤에 end를 주지 않는 기기를 위한 안전 시간. 끝내기·이어 듣기가 함께 쓴다 */
const FINALIZE_TIMEOUT_MS = 1_500;

const PAUSE_CAUSE_PARAMS = {
  'app-background': 'app_background',
  interrupted: 'interrupted',
  user: 'user',
  limit: 'limit',
} as const satisfies Record<VoicePauseCause, string>;

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
  const logger = useLogger();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();

  const [state, setState] = useState<VoiceCaptureState>(createVoiceCaptureState);
  const [isQuiet, setIsQuiet] = useState(false);
  const level = useSharedValue(0);
  const stateRef = useRef(state);
  const startOptionsRef = useRef<SpeechStartOptions | null>(null);
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeGapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linkRef = useRef(createVoiceRecognizerLink());
  const isQuietRef = useRef(false);
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

  const addBreadcrumb = (message: string, data?: Record<string, unknown>) => {
    errorReporter.addBreadcrumb({ category: 'voice', message, data });
  };

  const stopRecognizer = () => {
    updateLink({ type: 'stop-requested' });
    speechRecognizer.stop();
  };

  const clearQuiet = () => {
    if (quietTimerRef.current != null) {
      clearTimeout(quietTimerRef.current);
      quietTimerRef.current = null;
    }
    if (isQuietRef.current) {
      isQuietRef.current = false;
      setIsQuiet(false);
    }
  };

  const clearVolumeGap = () => {
    if (volumeGapTimerRef.current != null) {
      clearTimeout(volumeGapTimerRef.current);
      volumeGapTimerRef.current = null;
    }
  };

  const clearDeferredStart = () => {
    if (deferredStartTimerRef.current != null) {
      clearTimeout(deferredStartTimerRef.current);
      deferredStartTimerRef.current = null;
    }
  };

  const clearStallRestart = () => {
    if (stallRestartTimerRef.current != null) {
      clearTimeout(stallRestartTimerRef.current);
      stallRestartTimerRef.current = null;
    }
  };

  const clearTimers = () => {
    clearQuiet();
    clearVolumeGap();
    level.set(0);
    clearDeferredStart();
    clearStallRestart();
    if (finalizeTimerRef.current != null) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  };

  const trackFinished = (outcome: VoiceCaptureOutcome, at: VoiceCaptureState) => {
    const durationBucket = getDurationBucket(VoiceCapturePolicy.getElapsedMs(at, Date.now()));
    trackEvent('voice_capture_finished', {
      mode,
      outcome,
      duration_bucket: durationBucket,
      pause_count: at.pauseCount,
    });
    addBreadcrumb('capture.finished', { mode, duration_bucket: durationBucket });
  };

  const handleFinalized = () => {
    if (finalizeTimerRef.current != null) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    const { next } = dispatch({ type: 'end' });
    trackFinished(VoiceCapturePolicy.getCaptureOutcome(next), next);
  };

  function finish() {
    clearQuiet();
    clearDeferredStart();
    const { previous, next } = dispatch({ type: 'finish', at: Date.now() });
    if (previous === next) {
      return;
    }
    if (next.status === 'finalizing') {
      stopRecognizer();
      finalizeTimerRef.current = setTimeout(() => {
        finalizeTimerRef.current = null;
        handleFinalized();
      }, FINALIZE_TIMEOUT_MS);
      return;
    }
    trackFinished(VoiceCapturePolicy.getCaptureOutcome(next), next);
  }

  const markSilence = () => {
    if (mode !== 'quick' || isQuietRef.current || !VoiceCapturePolicy.canFinish(stateRef.current)) {
      return;
    }
    isQuietRef.current = true;
    setIsQuiet(true);
    quietTimerRef.current = setTimeout(() => {
      quietTimerRef.current = null;
      if (VoiceCapturePolicy.shouldAutoFinish(stateRef.current, AUTO_FINISH_SILENCE_MS)) {
        finish();
      }
    }, AUTO_FINISH_SILENCE_MS);
  };

  const handleError = (code: SpeechErrorCode) => {
    const { isStopRequested } = linkRef.current;
    const { previous, next } = dispatch({ type: 'error', code, at: Date.now(), isStopRequested });
    const startOptions = startOptionsRef.current;
    const context = { speech_error: code, on_device: startOptions?.isOnDevice };

    if (VoiceCapturePolicy.isRecognizerFailure(previous, code, isStopRequested)) {
      logger.error(VOICE_LOG_EVENT.RECOGNIZER_FAILED, new Error(code), context);
    } else {
      logger.info(VOICE_LOG_EVENT.RECOGNIZER_EXPECTED_STOP, context);
    }

    if (next.status === 'failed') {
      onFailed?.(next.transcript);
      clearTimers();
      haptics.notify('error');
      trackEvent('voice_capture_failed', { mode, reason: next.reason });
      return;
    }
    if (next.status === 'paused' && previous.status !== 'paused') {
      clearTimers();
      addBreadcrumb('capture.paused', { mode, cause: 'interrupted' });
    }
  };

  const restartSegment = () => {
    const startOptions = startOptionsRef.current;
    if (startOptions == null) {
      return;
    }
    const now = Date.now();
    if (VoiceCapturePolicy.isRestartLooping(linkRef.current, now)) {
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
    const isOnDevice = startOptionsRef.current?.isOnDevice ?? false;
    trackEvent('voice_recognizer_stalled', { mode, on_device: isOnDevice });
    addBreadcrumb('capture.recognizer-stalled', { mode, on_device: isOnDevice });
    stopRecognizer();
    stallRestartTimerRef.current = setTimeout(() => {
      stallRestartTimerRef.current = null;
      if (VoiceCapturePolicy.shouldRestartSegment(stateRef.current)) {
        speechRecognizer.abort();
      }
    }, FINALIZE_TIMEOUT_MS);
  };

  const watchRecognizerStall = (nextLevel: number) => {
    const now = Date.now();
    updateLink({ type: 'volume-sampled', level: nextLevel, at: now });
    const { isStopRequested, stallWatch } = linkRef.current;
    if (
      !isStopRequested &&
      VoiceCapturePolicy.shouldRestartStalledRecognizer(stateRef.current, stallWatch, now)
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
    deferredStartTimerRef.current = setTimeout(startPrepared, FINALIZE_TIMEOUT_MS);
  };

  function startPrepared() {
    clearDeferredStart();
    const startOptions = startOptionsRef.current;
    if (startOptions == null || getStatus() !== 'preparing') {
      return;
    }
    updateLink({ type: 'start-requested', at: Date.now() });
    speechRecognizer.start(startOptions);
  }

  const handleEvent = useEffectEvent((event: SpeechEvent) => {
    if (event.type === 'end') {
      updateLink({ type: 'ended' });
      clearStallRestart();
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
          clearQuiet();
        }
      })
      .with({ type: 'volume' }, ({ level: nextLevel }) => {
        level.set(nextLevel);
        clearVolumeGap();
        volumeGapTimerRef.current = setTimeout(() => {
          volumeGapTimerRef.current = null;
          level.set(0);
          markSilence();
        }, VOICE_NO_VOLUME_GAP_MS);
        if (VoiceCapturePolicy.isSpeaking(nextLevel, linkRef.current.lastTextAt, Date.now())) {
          clearQuiet();
        } else {
          markSilence();
        }
        watchRecognizerStall(nextLevel);
      })
      .with({ type: 'error' }, ({ code }) => handleError(code))
      .with({ type: 'end' }, () => {
        const current = stateRef.current;
        if (deferredStartTimerRef.current != null) {
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
    addBreadcrumb('capture.paused', { mode, cause });
  };

  const pauseForBackground = useEffectEvent(() => pause('app-background'));

  useEffect(() => {
    isUnmountedRef.current = false;
    const unsubscribe = speechRecognizer.subscribe(handleEvent);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        pauseForBackground();
      }
    });

    return () => {
      isUnmountedRef.current = true;
      unsubscribe();
      appStateSubscription.remove();
      clearTimers();
      if (VoiceCapturePolicy.isActive(stateRef.current)) {
        speechRecognizer.abort();
      }
    };
  }, [speechRecognizer]);

  const handleLimitReached = useEffectEvent(() => {
    if (onLimitReached == null) {
      finish();
      return;
    }
    pause('limit');
    onLimitReached();
  });

  const isListening = state.status === 'listening';
  useEffect(() => {
    if (!isListening) {
      return;
    }
    if (maxSeconds == null) {
      return;
    }
    const remainingMs = VoiceCapturePolicy.getRemainingCaptureMs(
      stateRef.current,
      maxSeconds,
      Date.now(),
    );
    const timer = setTimeout(() => handleLimitReached(), remainingMs);

    return () => clearTimeout(timer);
  }, [isListening, maxSeconds]);

  const runCaptured = useEffectEvent((transcript: string) => onCaptured(transcript));
  const notifyPlanFailed = useEffectEvent((transcript: VoiceTranscript) => onFailed?.(transcript));
  const isPlanning = state.status === 'planning';
  useEffect(() => {
    if (!isPlanning) {
      return;
    }
    let isCurrent = true;
    const text = VoiceTranscriptPolicy.getTranscriptText(stateRef.current.transcript);
    addBreadcrumb('plan.requested', { mode });
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

  const failPreparing = useEffectEvent(() => {
    speechRecognizer.abort();
    updateLink({ type: 'ended' });
    handleError('client');
  });

  // 시작 신호가 오지 않으면 듣는 중처럼 멈춰 있지 않고 글자를 든 실패 상태로 간다
  const isPreparing = state.status === 'preparing';
  useEffect(() => {
    if (!isPreparing) {
      return;
    }
    const timer = setTimeout(() => failPreparing(), VOICE_PREPARING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isPreparing]);

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
      trackEvent('voice_capture_started', {
        mode,
        entry,
        locale,
        on_device: isOnDevice,
      });
      addBreadcrumb('capture.started', { mode, locale, on_device: isOnDevice });
      return true;
    } catch (error) {
      if (isUnmountedRef.current) {
        return false;
      }
      logger.error(VOICE_LOG_EVENT.RECOGNIZER_FAILED, new Error(getErrorMessage(error)), {
        speech_error: 'unknown',
      });
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
      trackEvent('voice_capture_resumed', {
        mode,
        cause: PAUSE_CAUSE_PARAMS[previous.cause],
      });
      addBreadcrumb('capture.resumed', { mode });
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
      trackFinished(
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
      trackEvent('voice_capture_locale_changed', { mode, locale, on_device: canRecognizeOnDevice });
    }
    if (getStatus() === 'listening') {
      stopRecognizer();
    }
  };

  const getElapsedMs = () => VoiceCapturePolicy.getElapsedMs(stateRef.current, Date.now());

  return {
    state,
    level,
    isQuiet,
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

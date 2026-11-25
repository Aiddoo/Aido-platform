import {
  useAppLifecycle,
  useHaptics,
  useSpeechRecognizer,
} from '@src/bootstrap/providers/di-context';
import type { HapticsGateway } from '@src/core/ports/haptics-gateway';
import type { SpeechErrorCode, SpeechLocale } from '@src/core/ports/speech-recognizer';
import { noop } from 'es-toolkit';
import { type RefObject, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import {
  AUTO_FINISH_SILENCE_MS,
  VOICE_NO_VOLUME_GAP_MS,
  VOICE_PREPARING_TIMEOUT_MS,
} from '../constants/voice.constants';
import type { VoiceCaptureEntry, VoiceCaptureMode } from '../constants/voice.events';
import {
  type VoiceCaptureEvent,
  VoiceCapturePolicy,
  type VoiceCaptureSeed,
  type CapturedPlan,
  type VoiceCaptureState,
  type VoicePauseCause,
  type RecognizerUnresponsiveReason,
  createVoiceCaptureState,
} from '../domains/voice-capture.model';
import {
  isSpokenText,
  type SpeechResult,
  VoiceTranscriptPolicy,
  type VoiceTranscript,
} from '../domains/voice-transcript.model';
import { VoiceRecognizerSession } from '../services/voice-recognizer.session';
import { toAbandonedCaptureOutcome, toCaptureOutcome } from '../utils/voice-analytics';
import { useIsUnmountedRef } from './use-is-unmounted-ref';
import { useSpeechEvent } from './use-speech-event';
import {
  useVoiceCaptureTelemetry,
  type VoiceCaptureTelemetry,
} from './use-voice-capture-telemetry';

interface UseVoiceCaptureSessionOptions {
  entry: VoiceCaptureEntry;
  /** `quick`은 말이 멈추면 알아서 끝내고, `note`는 사용자가 끝낼 때까지 듣는다 */
  mode?: VoiceCaptureMode;
  /** 한 번에 들을 수 있는 길이(초). null이면 끝이 없다 */
  maxSeconds: number | null;
  /** 길이 한도에 닿았을 때. 없으면 바로 끝낸다 */
  onLimitReached?: () => void;
  /** 계획을 돌려주면 고르는 단계, null이면 처음으로 간다. 거절하면 글자를 남긴 채 실패 상태다 */
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
  /** 실패 상태를 그리기 전에 부른다. 렌더 뒤 effect에서 옮기면 Android에서 칸이 잠깐 비어 보인다 */
  onFailed?: (transcript: VoiceTranscript) => void;
}

interface BeginOptions {
  locale: SpeechLocale;
  hintWords: readonly string[];
  /** 녹음 파일을 남길 폴더. 남기지 않는 받아쓰기·빠른 말하기는 null이다 */
  recordingDirectory: string | null;
  seed?: VoiceCaptureSeed;
}

/** 그릴 값. 글자가 올 때마다 바뀐다 */
export interface VoiceCapture {
  state: VoiceCaptureState;
  /** 파형이 UI 스레드에서 읽는 음량 */
  level: SharedValue<number>;
  /** 말이 멈춰 곧 알아서 끝낼 참이다 */
  isQuiet: boolean;
}

export interface VoiceCaptureControls {
  /** 권한·동의·한도 확인을 마친 뒤 부른다. 시작했으면 true다 */
  begin: (options: BeginOptions) => Promise<boolean>;
  finish: () => void;
  pause: () => void;
  /** 다른 화면이 올라와 듣기를 멈춘다 */
  interrupt: () => void;
  resume: () => void;
  cancel: () => void;
  /** 들은 글자를 말로 메모하기로 넘겼다. 취소와 달리 이어 가는 것이라 따로 남긴다 */
  handOff: () => void;
  retryPlanning: () => void;
  changeLocale: (locale: SpeechLocale) => Promise<void>;
  getElapsedMs: () => number;
}

/** 시트가 세션을 소유해 회전에도 끊기지 않고, 백그라운드로 가면 글자를 확정하고 멈춰 이어 들을 수 있게 둔다 */
export function useVoiceCaptureSession({
  entry,
  mode = 'quick',
  maxSeconds,
  onLimitReached,
  onCaptured,
  onFailed,
}: UseVoiceCaptureSessionOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const haptics = useHaptics();
  const telemetry = useVoiceCaptureTelemetry({ entry, mode });
  const [state, machine] = useVoiceCaptureState();
  const [recognizer] = useState(
    () =>
      new VoiceRecognizerSession({
        speechRecognizer,
        isAwaitingStart: () => VoiceCapturePolicy.isAwaitingStart(machine.getState()),
        isListening: () => VoiceCapturePolicy.shouldRestartSegment(machine.getState()),
        isActive: () => VoiceCapturePolicy.isActive(machine.getState()),
      }),
  );
  const level = useSharedValue(0);
  const silence = useSilenceAutoFinish({
    isEnabled: mode === 'quick',
    canFinish: () => VoiceCapturePolicy.canFinish(machine.getState()),
    onVolumeGap: () => level.set(0),
  });
  const parts: VoiceCaptureParts = {
    machine,
    recognizer,
    silence,
    level,
    telemetry,
    haptics,
    onFailed,
  };

  useRecognizerEvents(parts);
  usePauseOnBackground(() => pauseCapture(parts, 'app-background'));
  const isUnmountedRef = useIsUnmountedRef();
  // 인식기 이벤트 구독을 먼저 푼 뒤에 끊어야 abort가 보낸 `end`가 내려가는 화면의 상태를 바꾸지 않는다
  useReleaseOnUnmount(() => releaseCapture(parts));
  useCaptureLimit({ parts, isListening: state.status === 'listening', maxSeconds, onLimitReached });
  useCapturePlanning({
    isPlanning: state.status === 'planning',
    machine,
    onCaptured,
    onFailed,
    onRequested: () => telemetry.planRequested(),
  });
  usePreparingTimeout({ parts, isPreparing: state.status === 'preparing' });
  const { begin, resume } = useStartCapture({ parts, mode, isUnmountedRef });
  const changeLocale = useChangeCaptureLocale({ parts, mode, isUnmountedRef });

  const capture: VoiceCapture = { state, level, isQuiet: silence.isQuiet };
  const controls: VoiceCaptureControls = {
    begin,
    finish: () => finishCapture(parts),
    pause: () => pauseCapture(parts, 'user'),
    interrupt: () => pauseCapture(parts, 'interrupted'),
    resume,
    cancel: () => resetCapture(parts, 'cancelled'),
    handOff: () => resetCapture(parts, 'upgraded'),
    retryPlanning: () => {
      machine.dispatch({ type: 'retry-plan' });
    },
    changeLocale,
    getElapsedMs: () => VoiceCapturePolicy.getElapsedMs(machine.getState(), Date.now()),
  };

  return [capture, controls] as const;
}

interface VoiceCaptureMachine {
  /** 인식기 이벤트와 타이머는 렌더를 기다리지 않고 방금 바뀐 상태를 읽는다 */
  getState: () => VoiceCaptureState;
  /** 바뀌지 않았으면 `previous`와 `next`가 같은 객체다 */
  dispatch: (event: VoiceCaptureEvent) => {
    previous: VoiceCaptureState;
    next: VoiceCaptureState;
  };
}

function useVoiceCaptureState(): [VoiceCaptureState, VoiceCaptureMachine] {
  const [state, setState] = useState<VoiceCaptureState>(createVoiceCaptureState);
  const stateRef = useRef(state);

  const getState = useCallback(() => stateRef.current, []);
  const dispatch = useCallback<VoiceCaptureMachine['dispatch']>((event) => {
    const previous = stateRef.current;
    const next = VoiceCapturePolicy.reduceVoiceCapture(previous, event);
    if (next !== previous) {
      stateRef.current = next;
      setState(next);
    }
    return { previous, next };
  }, []);

  return [state, { getState, dispatch }];
}

/** 한 세션이 가진 부품. 전이 함수와 지역 훅이 같은 묶음을 받아 인자를 하나씩 내리지 않는다 */
interface VoiceCaptureParts {
  machine: VoiceCaptureMachine;
  recognizer: VoiceRecognizerSession;
  silence: SilenceAutoFinish;
  /** 파형이 UI 스레드에서 읽는 음량 */
  level: SharedValue<number>;
  telemetry: VoiceCaptureTelemetry;
  haptics: HapticsGateway;
  onFailed?: (transcript: VoiceTranscript) => void;
}

/** 듣기가 멈추거나 끝나면 침묵·`end` 대기 타이머와 파형을 놓는다 */
function clearCaptureTimers({ silence, recognizer, level }: VoiceCaptureParts) {
  silence.clear();
  recognizer.cancelEndWaits();
  level.set(0);
}

function releaseCapture(parts: VoiceCaptureParts) {
  clearCaptureTimers(parts);
  parts.recognizer.dispose();
}

/** 닫은 구간이 끝났다(`end`가 왔거나 답이 없어 끝난 것으로 본다). 글자가 있으면 정리로, 없으면 처음으로 간다 */
function finalizeCapture({ machine, telemetry }: VoiceCaptureParts) {
  const { next } = machine.dispatch({ type: 'end' });
  telemetry.finished(toCaptureOutcome(next), next);
}

function finishCapture(parts: VoiceCaptureParts) {
  const { machine, recognizer, silence, telemetry } = parts;
  silence.cancelQuiet();
  recognizer.cancelDeferredStart();
  const { previous, next } = machine.dispatch({ type: 'finish', at: Date.now() });
  if (previous === next) {
    return;
  }
  if (next.status === 'finalizing') {
    recognizer.stopAndAwaitEnd(() => finalizeCapture(parts));
    return;
  }
  telemetry.finished(toCaptureOutcome(next), next);
}

function pauseCapture(parts: VoiceCaptureParts, cause: VoicePauseCause) {
  const { machine, recognizer, telemetry } = parts;
  const { previous, next } = machine.dispatch({ type: 'pause', cause, at: Date.now() });
  if (previous === next) {
    return;
  }
  clearCaptureTimers(parts);
  recognizer.stop();
  telemetry.paused(cause);
}

/** 듣기를 그만두고 처음으로 돌아간다. 열려 있던 세션이면 인식기를 끊고 결과를 남긴다 */
function resetCapture(parts: VoiceCaptureParts, outcome: 'cancelled' | 'upgraded') {
  const { machine, recognizer, telemetry } = parts;
  const previous = machine.getState();
  clearCaptureTimers(parts);
  machine.dispatch({ type: 'cancel' });
  if (VoiceCapturePolicy.isActive(previous)) {
    recognizer.abort();
  }
  if (VoiceCapturePolicy.shouldReportCancel(previous)) {
    telemetry.finished(toAbandonedCaptureOutcome(previous, outcome), previous);
  }
}

function settleFailure(
  parts: VoiceCaptureParts,
  failed: Extract<VoiceCaptureState, { status: 'failed' }>,
) {
  parts.onFailed?.(failed.transcript);
  clearCaptureTimers(parts);
  parts.haptics.notify('error');
  parts.telemetry.failed(failed.reason);
}

function applyRecognizerError(parts: VoiceCaptureParts, code: SpeechErrorCode) {
  const { machine, recognizer, telemetry } = parts;
  const isStopRequested = recognizer.isStopRequested();
  const { previous, next } = machine.dispatch({
    type: 'error',
    code,
    at: Date.now(),
    isStopRequested,
  });
  const isOnDevice = recognizer.getStartOptions()?.isOnDevice;

  if (VoiceCapturePolicy.isRecognizerFailure(previous, { code, isStopRequested })) {
    telemetry.recognizerFailed(code, isOnDevice);
  } else {
    telemetry.recognizerStopped(code, isOnDevice);
  }

  // 상태를 바꾸지 않은 오류(멈춤 응답, 이미 실패한 세션에 늦게 온 오류)는 진단만 남기고 실패를 또 알리지 않는다
  if (previous === next) {
    return;
  }
  if (next.status === 'failed') {
    settleFailure(parts, next);
    return;
  }
  if (next.status === 'paused') {
    clearCaptureTimers(parts);
    telemetry.paused('interrupted');
  }
}

function applyRecognizerUnresponsive(
  parts: VoiceCaptureParts,
  reason: RecognizerUnresponsiveReason,
) {
  const { machine, recognizer, telemetry } = parts;
  const { next } = machine.dispatch({ type: 'unresponsive', reason, at: Date.now() });
  telemetry.recognizerUnresponsive(reason, recognizer.getStartOptions()?.isOnDevice);
  if (next.status === 'failed') {
    settleFailure(parts, next);
  }
}

/** 인식기 이벤트가 상태·연결·침묵 감시에 닿는 순서를 정한다. 듣지 않을 때 온 이벤트는 `end`만 연결에 남긴다 */
function useRecognizerEvents(parts: VoiceCaptureParts) {
  const appLifecycle = useAppLifecycle();
  const { machine, recognizer, silence, level, telemetry } = parts;

  const handleStart = () => {
    // 취소 직후 다시 시작해 기능을 확인하는 사이 끊은 앞 구간의 시작 신호가 늦게 오면, 옵션도 없이 듣는 중이 된다
    if (!recognizer.shouldAcceptStart()) {
      return;
    }
    const now = Date.now();
    machine.dispatch({ type: 'start', at: now });
    recognizer.noteStarted(now);
    // 준비 중에는 멈출 수 없어 백그라운드 전환이 무시된다. 뒤늦은 시작 신호로 몰래 듣지 않는다
    if (appLifecycle.getCurrentState() === 'background') {
      pauseCapture(parts, 'app-background');
    }
  };

  const handleResult = ({ transcript, isFinal }: SpeechResult) => {
    machine.dispatch({ type: 'result', result: { transcript, isFinal } });
    if (isSpokenText(transcript)) {
      recognizer.noteTextHeard(transcript, Date.now());
      silence.cancelQuiet();
    }
  };

  /** 말이 멈춘 채 시간이 지났다. 그 사이 다시 말했거나 멈췄으면 끝내지 않는다 */
  const finishIfStillSilent = (silentMs: number) => {
    if (VoiceCapturePolicy.shouldAutoFinish(machine.getState(), silentMs, AUTO_FINISH_SILENCE_MS)) {
      finishCapture(parts);
    }
  };

  const handleVolume = (nextLevel: number) => {
    const now = Date.now();
    level.set(nextLevel);
    silence.noteVolume(recognizer.isSpeaking(nextLevel, now), finishIfStillSilent);
    recognizer.sampleVolume(nextLevel, now);
    if (recognizer.isStalled(machine.getState(), now)) {
      telemetry.stalled(recognizer.getStartOptions()?.isOnDevice ?? false);
      recognizer.closeStalledSegment(now);
    }
  };

  const handleEnd = () => {
    const action = VoiceCapturePolicy.findSegmentEndAction(
      machine.getState(),
      recognizer.hasDeferredStart(),
    );
    match(action)
      .with('start-deferred', () => recognizer.startDeferred())
      .with('restart-segment', () => {
        machine.dispatch({ type: 'end' });
        // 다시 열지 못하면(연달아 끝나거나 정한 옵션이 없으면) 인식기 없이 듣는 중으로 남기지 않고 글자를 든 실패로 멈춘다
        if (!recognizer.restartSegment()) {
          applyRecognizerUnresponsive(parts, 'restart-loop');
        }
      })
      .with('finalize', () => finalizeCapture(parts))
      .with(null, noop)
      .exhaustive();
  };

  useSpeechEvent((event) => {
    if (event.type === 'end') {
      recognizer.noteEnded();
    }
    if (!VoiceCapturePolicy.isActive(machine.getState())) {
      return;
    }
    match(event)
      .with({ type: 'start' }, handleStart)
      .with({ type: 'result' }, handleResult)
      .with({ type: 'volume' }, ({ level: nextLevel }) => handleVolume(nextLevel))
      .with({ type: 'error' }, ({ code }) => applyRecognizerError(parts, code))
      .with({ type: 'end' }, handleEnd)
      .with({ type: 'no-match' }, { type: 'recording-started' }, { type: 'recording-saved' }, noop)
      .exhaustive();
  });
}

interface UseSilenceAutoFinishOptions {
  isEnabled: boolean;
  canFinish: () => boolean;
  /** 음량 이벤트가 끊겼다. `isEnabled`와 상관없이 부른다 */
  onVolumeGap: () => void;
}

/** 말이 멈춘 채 `AUTO_FINISH_SILENCE_MS`가 지났다. 실제로 멈춘 시간을 넘긴다 */
type SilenceListener = (silentMs: number) => void;

interface SilenceAutoFinish {
  /** 말이 멈춰 곧 알아서 끝낼 참이다 */
  isQuiet: boolean;
  noteVolume: (isSpeaking: boolean, onSilence: SilenceListener) => void;
  cancelQuiet: () => void;
  clear: () => void;
}

/** 말이 멈춘 것을 음량과 글자로 판단해 잠시 뒤 알린다. 알릴 곳은 음량을 넘길 때마다 받는다 */
function useSilenceAutoFinish({
  isEnabled,
  canFinish,
  onVolumeGap,
}: UseSilenceAutoFinishOptions): SilenceAutoFinish {
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

  const markSilence = (onSilence: SilenceListener) => {
    if (!isEnabled || isQuietRef.current || !canFinish()) {
      return;
    }
    isQuietRef.current = true;
    setIsQuiet(true);
    const quietSince = Date.now();
    timers.set('quiet', () => onSilence(Date.now() - quietSince), AUTO_FINISH_SILENCE_MS);
  };

  const noteVolume = (isSpeaking: boolean, onSilence: SilenceListener) => {
    timers.set(
      'volumeGap',
      () => {
        onVolumeGap();
        markSilence(onSilence);
      },
      VOICE_NO_VOLUME_GAP_MS,
    );
    if (isSpeaking) {
      cancelQuiet();
    } else {
      markSilence(onSilence);
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

function useReleaseOnUnmount(release: () => void) {
  const releaseOnUnmount = useEffectEvent(release);

  useEffect(() => () => releaseOnUnmount(), []);
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

interface UseCaptureLimitOptions {
  parts: VoiceCaptureParts;
  isListening: boolean;
  maxSeconds: number | null;
  onLimitReached?: () => void;
}

/** 한 번에 들을 수 있는 길이에 닿으면 끝낸다. 한도 알림을 받는 화면이면 멈추고 알려 고르게 한다 */
function useCaptureLimit({
  parts,
  isListening,
  maxSeconds,
  onLimitReached,
}: UseCaptureLimitOptions) {
  useTimeoutWhile({
    isActive: isListening,
    getDelayMs: () =>
      maxSeconds == null
        ? null
        : VoiceCapturePolicy.getRemainingCaptureMs(
            parts.machine.getState(),
            maxSeconds,
            Date.now(),
          ),
    onTimeout: () => {
      if (onLimitReached == null) {
        finishCapture(parts);
        return;
      }
      pauseCapture(parts, 'limit');
      onLimitReached();
    },
    restartKey: maxSeconds,
  });
}

interface UsePreparingTimeoutOptions {
  parts: VoiceCaptureParts;
  isPreparing: boolean;
}

/** 시작 신호가 오지 않으면 듣는 중처럼 멈춰 있지 않고 글자를 든 실패 상태로 간다 */
function usePreparingTimeout({ parts, isPreparing }: UsePreparingTimeoutOptions) {
  useTimeoutWhile({
    isActive: isPreparing,
    getDelayMs: () => VOICE_PREPARING_TIMEOUT_MS,
    restartKey: null,
    onTimeout: () => {
      parts.recognizer.abort();
      applyRecognizerUnresponsive(parts, 'preparing-timeout');
    },
  });
}

interface UseCapturePlanningOptions {
  isPlanning: boolean;
  machine: VoiceCaptureMachine;
  onCaptured: (transcript: string) => Promise<CapturedPlan | null>;
  onFailed?: (transcript: VoiceTranscript) => void;
  onRequested: () => void;
}

/** 결과가 오기 전에 계획 단계를 떠났으면(취소·다시 시도) 그 결과는 버린다 */
function useCapturePlanning({
  isPlanning,
  machine,
  onCaptured,
  onFailed,
  onRequested,
}: UseCapturePlanningOptions) {
  const { getState, dispatch } = machine;
  const runCaptured = useEffectEvent((transcript: string) => onCaptured(transcript));
  const notifyPlanFailed = useEffectEvent((transcript: VoiceTranscript) => onFailed?.(transcript));
  const trackPlanRequested = useEffectEvent(onRequested);

  useEffect(() => {
    if (!isPlanning) {
      return;
    }
    const planning = new AbortController();
    const text = VoiceTranscriptPolicy.getTranscriptText(getState().transcript);
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
  }, [isPlanning, getState, dispatch]);
}

type StartRequest = Omit<BeginOptions, 'seed'>;

interface StartCapture {
  begin: VoiceCaptureControls['begin'];
  resume: VoiceCaptureControls['resume'];
}

interface UseStartCaptureOptions {
  parts: VoiceCaptureParts;
  mode: VoiceCaptureMode;
  /** 내려간 뒤 끝난 기능 확인이 인식기를 켜지 못하게 막는다. 켜면 아무도 끄지 못한다 */
  isUnmountedRef: RefObject<boolean>;
}

/** 듣기를 연다. 기능을 확인해 시작 옵션을 정한 뒤 인식기를 열고, 이어 듣기는 정해 둔 옵션으로 다시 연다 */
function useStartCapture({ parts, mode, isUnmountedRef }: UseStartCaptureOptions): StartCapture {
  const speechRecognizer = useSpeechRecognizer();
  const { machine, recognizer, telemetry, haptics } = parts;
  // 기능 확인이 실패하면 시작 옵션을 정하지 못한 채 멈춘다. 이어 듣기가 이 요청으로 확인부터 다시 한다
  const requestRef = useRef<StartRequest | null>(null);
  // 취소하고 다시 시작한 뒤 늦게 끝난 앞 확인이 새 듣기의 옵션을 정하거나 새 듣기를 실패로 만들지 못하게 확인마다 번호를 매긴다
  const checkCountRef = useRef(0);

  const startWithCapabilities = async (
    { locale, hintWords, recordingDirectory }: StartRequest,
    isOutdated: () => boolean,
  ): Promise<boolean> => {
    const capabilities = await speechRecognizer.getCapabilities(mode, locale);
    if (isOutdated() || !VoiceCapturePolicy.isAwaitingStart(machine.getState())) {
      return false;
    }
    const isOnDevice = capabilities.canRecognizeOnDevice;
    recognizer.setStartOptions({ locale, mode, hintWords, isOnDevice, recordingDirectory });
    if (!capabilities.isAvailable) {
      applyRecognizerError(parts, 'service-not-allowed');
      return false;
    }
    recognizer.startAfterEnd();
    haptics.impact('light');
    telemetry.started(locale, isOnDevice);
    return true;
  };

  // 조건이 든 try는 React Compiler가 이 훅을 건너뛰게 해 실패를 Promise로 받는다
  const prepare = (request: StartRequest): Promise<boolean> => {
    checkCountRef.current += 1;
    const checkNumber = checkCountRef.current;
    const isOutdated = () => isUnmountedRef.current || checkCountRef.current !== checkNumber;

    return startWithCapabilities(request, isOutdated).catch((error: unknown) => {
      if (isOutdated()) {
        return false;
      }
      telemetry.capabilityCheckFailed(error);
      applyRecognizerError(parts, 'unknown');
      return false;
    });
  };

  const begin = async ({ seed, ...request }: BeginOptions): Promise<boolean> => {
    if (isUnmountedRef.current || !VoiceCapturePolicy.canBegin(machine.getState())) {
      return false;
    }
    requestRef.current = request;
    // 앞 듣기에서 정한 옵션으로 이어 듣지 않게 비운다. 이번 기능 확인이 끝나야 다시 정해진다
    recognizer.setStartOptions(null);
    machine.dispatch({ type: 'prepare', seed });
    return prepare(request);
  };

  const resume = () => {
    const request = requestRef.current;
    if (request == null) {
      return;
    }
    const { previous, next } = machine.dispatch({ type: 'resume' });
    if (previous === next) {
      return;
    }
    if (recognizer.getStartOptions() == null) {
      prepare(request);
    } else {
      recognizer.startAfterEnd();
    }
    if (previous.status === 'paused') {
      telemetry.resumed(previous.cause);
    }
  };

  return { begin, resume };
}

interface PendingLocaleChange {
  locale: SpeechLocale;
  change: Promise<void>;
}

interface UseChangeCaptureLocaleOptions {
  parts: VoiceCaptureParts;
  mode: VoiceCaptureMode;
  /** 내려간 뒤 끝난 언어 확인이 다른 세션의 인식기를 멈추지 못하게 막는다 */
  isUnmountedRef: RefObject<boolean>;
}

/** 다음 구간부터 쓸 언어를 바꾼다. 듣는 중이면 구간을 닫아 그 `end`에서 새 언어로 다시 열리게 한다 */
function useChangeCaptureLocale({
  parts,
  mode,
  isUnmountedRef,
}: UseChangeCaptureLocaleOptions): VoiceCaptureControls['changeLocale'] {
  const speechRecognizer = useSpeechRecognizer();
  const { machine, recognizer, telemetry } = parts;
  // 확인이 끝나기 전에 같은 언어를 또 누르면 구간을 두 번 닫고 이벤트를 두 번 남긴다. 진행 중인 바꾸기를 함께 기다린다
  const pendingRef = useRef<PendingLocaleChange | null>(null);

  const applyLocale = async (locale: SpeechLocale) => {
    const { canRecognizeOnDevice } = await speechRecognizer.getCapabilities(mode, locale);
    // 확인하는 사이 새로 듣기 시작했으면 옵션이 비어 있다. 앞 듣기의 옵션을 되살리지 않는다
    const startOptions = recognizer.getStartOptions();
    if (isUnmountedRef.current || startOptions == null) {
      return;
    }
    recognizer.setStartOptions({ ...startOptions, locale, isOnDevice: canRecognizeOnDevice });
    if (VoiceCapturePolicy.isActive(machine.getState())) {
      telemetry.localeChanged(locale, canRecognizeOnDevice);
    }
    if (VoiceCapturePolicy.shouldRestartSegment(machine.getState())) {
      recognizer.stop();
    }
  };

  return (locale) => {
    const startOptions = recognizer.getStartOptions();
    if (startOptions == null || startOptions.locale === locale) {
      return Promise.resolve();
    }
    const pending = pendingRef.current;
    if (pending?.locale === locale) {
      return pending.change;
    }
    // 언어가 아니라 이 바꾸기 자체로 견준다. A → B → A에서 앞 A의 정리가 뒤 A의 표시를 지우지 않는다
    const entry: PendingLocaleChange = {
      locale,
      change: applyLocale(locale).finally(() => {
        if (pendingRef.current === entry) {
          pendingRef.current = null;
        }
      }),
    };
    pendingRef.current = entry;
    return entry.change;
  };
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
  restartKey: number | null;
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
  };
}

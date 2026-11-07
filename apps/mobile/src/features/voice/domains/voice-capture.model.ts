import type { SpeechErrorCode } from '@src/core/ports/speech-recognizer';
import { match, P } from 'ts-pattern';

import {
  AUTO_FINISH_SILENCE_MS,
  QUICK_CAPTURE_MAX_SECONDS,
  SPEAKING_VOLUME_THRESHOLD,
  SPEECH_TEXT_GRACE_MS,
  VOICE_RESTART_LOOP,
  VOICE_STALL_RESTART,
} from '../constants/voice.constants';
import type {
  CapturedPlan,
  VoiceCaptureFailureReason,
  VoiceCaptureState,
  VoicePauseCause,
  VoiceStallWatch,
} from '../schemas/voice-capture.schema';
import type { SpeechResult, VoiceTranscript } from '../schemas/voice-transcript.schema';
import {
  applyResult,
  createVoiceTranscript,
  isTranscriptEmpty,
  withInterimFinalized,
} from './voice-transcript.model';

export interface VoiceCaptureSeed {
  transcript: VoiceTranscript;
  elapsedMs: number;
}

export type VoiceCaptureEvent =
  | { type: 'prepare'; seed?: VoiceCaptureSeed }
  | { type: 'start'; at: number }
  | { type: 'result'; result: SpeechResult }
  | { type: 'pause'; cause: VoicePauseCause; at: number }
  | { type: 'resume' }
  | { type: 'finish'; at: number }
  | { type: 'end' }
  /** `isStopRequested`: 이 구간은 앱이 이미 stop을 불렀다 */
  | { type: 'error'; code: SpeechErrorCode; at: number; isStopRequested?: boolean }
  | { type: 'planned'; result: CapturedPlan | null }
  | { type: 'plan-failed' }
  | { type: 'retry-plan' }
  | { type: 'cancel' };

export function createVoiceCaptureState(): VoiceCaptureState {
  return { status: 'idle', transcript: createVoiceTranscript(), elapsedMs: 0, pauseCount: 0 };
}

function getElapsedMs(state: VoiceCaptureState, now: number): number {
  return state.status === 'listening'
    ? state.elapsedMs + Math.max(0, now - state.listeningSince)
    : state.elapsedMs;
}

function toFinishedSegment(state: VoiceCaptureState, at: number) {
  const { transcript, pauseCount } = state;
  return { transcript, elapsedMs: getElapsedMs(state, at), pauseCount };
}

function toFailed(
  state: VoiceCaptureState,
  reason: VoiceCaptureFailureReason,
  at: number,
): VoiceCaptureState {
  const segment = toFinishedSegment(state, at);
  return {
    ...segment,
    transcript: withInterimFinalized(segment.transcript),
    status: 'failed',
    reason,
  };
}

/** 결과 없이 끝나면 서버를 부르지 않는다 */
function toFinalized(state: VoiceCaptureState): VoiceCaptureState {
  const { elapsedMs, pauseCount } = state;
  const transcript = withInterimFinalized(state.transcript);
  return {
    transcript,
    elapsedMs,
    pauseCount,
    status: isTranscriptEmpty(transcript) ? 'idle' : 'planning',
  };
}

/**
 * Android 인식기는 stop 뒤에 마지막 결과 대신 ERROR_CLIENT를 줄 수 있고, 어느 쪽이든 이어서 end가 온다.
 * 앱이 스스로 멈춘 구간의 client는 실패가 아니라 정상 종료이고, 글자 확정은 end가 맡는다.
 */
function isStopAcknowledgement(
  state: VoiceCaptureState,
  code: SpeechErrorCode,
  isStopRequested: boolean = false,
): boolean {
  return (
    code === 'client' &&
    (isStopRequested || state.status === 'finalizing' || state.status === 'paused')
  );
}

/** 이 오류가 나면 앱이 고칠 일이 아니라 버그·기기 문제라 Sentry 이벤트로 남긴다 */
const RECOGNIZER_FAILURE_CODES: ReadonlySet<SpeechErrorCode> = new Set([
  'audio-capture',
  'client',
  'busy',
  'service-not-allowed',
  'unknown',
]);

function isRecognizerFailure(
  state: VoiceCaptureState,
  code: SpeechErrorCode,
  isStopRequested: boolean,
): boolean {
  return RECOGNIZER_FAILURE_CODES.has(code) && !isStopAcknowledgement(state, code, isStopRequested);
}

export function reduceVoiceCapture(
  state: VoiceCaptureState,
  event: VoiceCaptureEvent,
): VoiceCaptureState {
  return (
    match([state, event] as const)
      .returnType<VoiceCaptureState>()
      .with([{ status: 'idle' }, { type: 'prepare' }], ([current, { seed }]) => ({
        ...current,
        ...seed,
        status: 'preparing',
      }))
      .with([{ status: P.union('paused', 'failed') }, { type: 'resume' }], ([current]) => ({
        transcript: withInterimFinalized(current.transcript),
        elapsedMs: current.elapsedMs,
        pauseCount: current.pauseCount,
        status: 'preparing',
      }))
      .with([{ status: 'preparing' }, { type: 'start' }], ([current, { at }]) => ({
        transcript: current.transcript,
        elapsedMs: current.elapsedMs,
        pauseCount: current.pauseCount,
        status: 'listening',
        listeningSince: at,
      }))
      .with(
        [{ status: P.union('listening', 'paused', 'finalizing') }, { type: 'result' }],
        ([current, { result }]) => ({
          ...current,
          transcript: applyResult(current.transcript, result),
        }),
      )
      .with([{ status: 'listening' }, { type: 'pause' }], ([current, { cause, at }]) => ({
        ...toFinishedSegment(current, at),
        pauseCount: current.pauseCount + 1,
        status: 'paused',
        cause,
      }))
      .with(
        [{ status: P.union('preparing', 'listening') }, { type: 'finish' }],
        ([current, { at }]) => ({
          ...toFinishedSegment(current, at),
          status: 'finalizing',
        }),
      )
      // final 없이 구간이 끝나면 다음 구간의 글자가 덮지 않게 듣던 글자를 먼저 확정한다
      .with([{ status: 'listening' }, { type: 'end' }], ([current]) => ({
        ...current,
        transcript: withInterimFinalized(current.transcript),
      }))
      .with([{ status: 'paused' }, { type: 'finish' }], ([current]) => toFinalized(current))
      .with(
        [{ status: 'failed', reason: P.not('planning-failed') }, { type: 'finish' }],
        ([current]) => toFinalized(current),
      )
      .with([{ status: 'finalizing' }, { type: 'end' }], ([current]) => toFinalized(current))
      .with(
        [{ status: P.union('preparing', 'listening', 'finalizing') }, { type: 'error' }],
        ([current, { code, at, isStopRequested }]) =>
          match(code)
            .returnType<VoiceCaptureState>()
            .with('no-speech', 'speech-timeout', 'aborted', () => current)
            .with('client', () =>
              isStopAcknowledgement(current, code, isStopRequested)
                ? current
                : toFailed(current, code, at),
            )
            .with('interrupted', () =>
              current.status === 'listening'
                ? {
                    ...toFinishedSegment(current, at),
                    pauseCount: current.pauseCount + 1,
                    status: 'paused',
                    cause: 'interrupted',
                  }
                : toFailed(current, code, at),
            )
            .otherwise(() => toFailed(current, code, at)),
      )
      .with([{ status: 'planning' }, { type: 'planned' }], ([current, { result }]) =>
        result == null ? createVoiceCaptureState() : { ...current, ...result, status: 'review' },
      )
      .with([{ status: 'planning' }, { type: 'plan-failed' }], ([current]) => ({
        ...current,
        status: 'failed',
        reason: 'planning-failed',
      }))
      .with(
        [{ status: 'failed', reason: 'planning-failed' }, { type: 'retry-plan' }],
        ([current]) => ({
          transcript: current.transcript,
          elapsedMs: current.elapsedMs,
          pauseCount: current.pauseCount,
          status: 'planning',
        }),
      )
      .with([P._, { type: 'cancel' }], () => createVoiceCaptureState())
      .otherwise(([current]) => current)
  );
}

/** 듣기가 끝났는데 사용자가 끝내지 않았다면(침묵·인식기 제한 시간) 같은 세션을 다시 연다 */
function shouldRestartSegment(state: VoiceCaptureState): boolean {
  return state.status === 'listening';
}

export function createVoiceStallWatch(
  now: number,
  lastRestartAt: number | null = null,
): VoiceStallWatch {
  return { lastTextAt: now, voicedMs: 0, lastSampleAt: null, isVoiceAudible: false, lastRestartAt };
}

export function withVolumeSample(
  watch: VoiceStallWatch,
  level: number,
  now: number,
): VoiceStallWatch {
  const isVoiceAudible = level >= SPEAKING_VOLUME_THRESHOLD;
  const gapMs = watch.lastSampleAt == null ? 0 : Math.max(0, now - watch.lastSampleAt);
  return {
    ...watch,
    voicedMs:
      watch.voicedMs + (isVoiceAudible && gapMs <= VOICE_STALL_RESTART.maxSampleGapMs ? gapMs : 0),
    lastSampleAt: now,
    isVoiceAudible,
  };
}

export function withTextHeard(watch: VoiceStallWatch, now: number): VoiceStallWatch {
  return { ...createVoiceStallWatch(now), lastSampleAt: watch.lastSampleAt };
}

export function withStallRestart(now: number): VoiceStallWatch {
  return createVoiceStallWatch(now, now);
}

function shouldRestartStalledRecognizer(
  state: VoiceCaptureState,
  watch: VoiceStallWatch,
  now: number,
): boolean {
  return (
    state.status === 'listening' &&
    watch.isVoiceAudible &&
    watch.voicedMs >= VOICE_STALL_RESTART.voicedMs &&
    now - watch.lastTextAt >= VOICE_STALL_RESTART.textlessMs &&
    (watch.lastRestartAt == null || now - watch.lastRestartAt >= VOICE_STALL_RESTART.minIntervalMs)
  );
}

/** 인식기와 세션의 연결 상태. 화면에 보이지 않고 시각은 호출한 쪽이 넘긴다 */
export interface VoiceRecognizerLink {
  /** 인식기에 시작을 맡긴 뒤 `end`를 아직 받지 못했다 */
  isRunning: boolean;
  /** 지금 구간에 앱이 stop을 불렀다. 그 구간의 `end`나 다음 시작까지 유지한다 */
  isStopRequested: boolean;
  lastStartedAt: number;
  quickEndCount: number;
  lastTextAt: number | null;
  lastTranscript: string;
  stallWatch: VoiceStallWatch;
}

export type VoiceRecognizerLinkEvent =
  /** 준비를 마치고 인식기에 시작을 맡겼다. 재시작 횟수와 멈춤 감시를 새로 센다 */
  | { type: 'start-requested'; at: number }
  /** 사용자가 끝내지 않았는데 구간이 끝나 같은 세션을 다시 열었다 */
  | { type: 'segment-restarted'; at: number }
  /** 인식기가 시작 신호를 보냈다 */
  | { type: 'started'; at: number }
  | { type: 'stop-requested' }
  /** 글자 없이 말소리만 들려 구간을 닫는다 */
  | { type: 'stall-restarted'; at: number }
  /** `end`를 받았거나 abort로 끝난 것으로 본다 */
  | { type: 'ended' }
  | { type: 'text-heard'; transcript: string; at: number }
  | { type: 'volume-sampled'; level: number; at: number };

export function createVoiceRecognizerLink(): VoiceRecognizerLink {
  return {
    isRunning: false,
    isStopRequested: false,
    lastStartedAt: 0,
    quickEndCount: 0,
    lastTextAt: null,
    lastTranscript: '',
    stallWatch: createVoiceStallWatch(0),
  };
}

function getQuickEndCount(
  { lastStartedAt, quickEndCount }: Pick<VoiceRecognizerLink, 'lastStartedAt' | 'quickEndCount'>,
  now: number,
): number {
  return now - lastStartedAt < VOICE_RESTART_LOOP.windowMs ? quickEndCount + 1 : 0;
}

function isRestartLooping(
  link: Pick<VoiceRecognizerLink, 'lastStartedAt' | 'quickEndCount'>,
  now: number,
): boolean {
  return getQuickEndCount(link, now) >= VOICE_RESTART_LOOP.limit;
}

export function reduceRecognizerLink(
  link: VoiceRecognizerLink,
  event: VoiceRecognizerLinkEvent,
): VoiceRecognizerLink {
  return match(event)
    .returnType<VoiceRecognizerLink>()
    .with({ type: 'start-requested' }, ({ at }) => ({
      ...link,
      isRunning: true,
      isStopRequested: false,
      lastStartedAt: at,
      quickEndCount: 0,
      stallWatch: createVoiceStallWatch(at),
    }))
    .with({ type: 'segment-restarted' }, ({ at }) => ({
      ...link,
      isRunning: true,
      isStopRequested: false,
      lastStartedAt: at,
      quickEndCount: getQuickEndCount(link, at),
    }))
    .with({ type: 'started' }, ({ at }) => ({
      ...link,
      stallWatch: createVoiceStallWatch(at, link.stallWatch.lastRestartAt),
    }))
    .with({ type: 'stop-requested' }, () => ({ ...link, isStopRequested: true }))
    .with({ type: 'stall-restarted' }, ({ at }) => ({ ...link, stallWatch: withStallRestart(at) }))
    .with({ type: 'ended' }, () => ({ ...link, isRunning: false, isStopRequested: false }))
    .with({ type: 'text-heard' }, ({ transcript, at }) => ({
      ...link,
      lastTranscript: transcript,
      lastTextAt: transcript === link.lastTranscript ? link.lastTextAt : at,
      // stop 뒤에 온 마지막 결과는 살아 있다는 뜻이 아니다. 다시 연 간격을 지우지 않는다
      stallWatch: link.isStopRequested ? link.stallWatch : withTextHeard(link.stallWatch, at),
    }))
    .with({ type: 'volume-sampled' }, ({ level, at }) => ({
      ...link,
      stallWatch: withVolumeSample(link.stallWatch, level, at),
    }))
    .exhaustive();
}

function isActive(state: VoiceCaptureState): boolean {
  return (
    state.status === 'preparing' ||
    state.status === 'listening' ||
    state.status === 'paused' ||
    state.status === 'finalizing'
  );
}

function isWrappingUp(state: VoiceCaptureState): boolean {
  return state.status === 'finalizing' || state.status === 'planning';
}

function canFinish(state: VoiceCaptureState): boolean {
  const isStopped =
    state.status === 'paused' || (state.status === 'failed' && state.reason !== 'planning-failed');
  return (state.status === 'listening' || isStopped) && !isTranscriptEmpty(state.transcript);
}

function canResume(state: VoiceCaptureState): boolean {
  return match(state)
    .with({ status: 'paused' }, () => true)
    .with(
      {
        status: 'failed',
        reason: P.union(
          'planning-failed',
          'not-allowed',
          'service-not-allowed',
          'language-not-supported',
        ),
      },
      () => false,
    )
    .with({ status: 'failed' }, () => true)
    .otherwise(() => false);
}

function canResumeWithinLimit(state: VoiceCaptureState, limitMs: number | null): boolean {
  return canResume(state) && (limitMs == null || state.elapsedMs < limitMs);
}

function canRetryPlanning(state: VoiceCaptureState): boolean {
  return (
    state.status === 'failed' &&
    state.reason === 'planning-failed' &&
    !isTranscriptEmpty(state.transcript)
  );
}

function isSpeaking(level: number, lastTextAt: number | null, now: number): boolean {
  return (
    level >= SPEAKING_VOLUME_THRESHOLD &&
    (lastTextAt == null || now - lastTextAt < SPEECH_TEXT_GRACE_MS)
  );
}

function shouldAutoFinish(
  state: VoiceCaptureState,
  silentMs: number,
  silenceLimitMs: number = AUTO_FINISH_SILENCE_MS,
): boolean {
  return canFinish(state) && silentMs >= silenceLimitMs;
}

type VoiceDismissAction = 'cancel-capture' | 'cancel-planning' | 'confirm-discard';

/** 시트의 바깥 탭과 Android 뒤로 가기. 듣기·정리는 X와 같고, 고를 카드가 있으면 계획을 잃기 전에 묻는다. null이면 시트가 닫힌다 */
function getDismissAction(state: VoiceCaptureState): VoiceDismissAction | null {
  return match(state)
    .returnType<VoiceDismissAction | null>()
    .with({ status: 'review' }, ({ plan }) =>
      plan.actions.length === 0 ? null : 'confirm-discard',
    )
    .with({ status: 'planning' }, () => 'cancel-planning')
    .when(isActive, () => 'cancel-capture')
    .otherwise(() => null);
}

/** 차감된 계획을 고르는 단계인지. 떠나면 이미 쓴 횟수를 잃는다 */
function isChargedReview(state: VoiceCaptureState): boolean {
  return state.status === 'review' && state.isCharged;
}

/** 듣기를 끝낸 뒤의 상태로 결과를 나눈다. 글자가 있으면 정리로 가고 없으면 처음으로 돌아간다 */
function getCaptureOutcome(state: Pick<VoiceCaptureState, 'status'>): 'completed' | 'empty' {
  return state.status === 'planning' ? 'completed' : 'empty';
}

/** 일시정지를 지나도 앞서 들은 시간을 뺀 만큼만 더 듣는다 */
function getRemainingCaptureMs(state: VoiceCaptureState, maxSeconds: number, now: number): number {
  return Math.max(0, maxSeconds * 1_000 - getElapsedMs(state, now));
}

function isOverQuickLimit(
  state: VoiceCaptureState,
  now: number,
  maxSeconds: number = QUICK_CAPTURE_MAX_SECONDS,
): boolean {
  return getElapsedMs(state, now) >= maxSeconds * 1_000;
}

function shouldOfferVoiceNote(state: VoiceCaptureState, now: number): boolean {
  return state.status === 'paused' && isOverQuickLimit(state, now);
}

export const VoiceCapturePolicy = {
  isStopAcknowledgement,
  isRecognizerFailure,
  isRestartLooping,
  getCaptureOutcome,
  getRemainingCaptureMs,
  shouldRestartSegment,
  shouldRestartStalledRecognizer,
  isActive,
  isWrappingUp,
  canFinish,
  canResume,
  canResumeWithinLimit,
  canRetryPlanning,
  shouldAutoFinish,
  isSpeaking,
  isOverQuickLimit,
  shouldOfferVoiceNote,
  getDismissAction,
  isChargedReview,
  getElapsedMs,
} as const;

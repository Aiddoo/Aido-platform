import type { SpeechErrorCode, SpeechStartOptions } from '@src/core/ports/speech-recognizer';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { uniq } from 'es-toolkit';
import { match, P } from 'ts-pattern';

import { COMMON_SPEECH_HINTS } from '../constants/speech-hints';
import {
  AUTO_FINISH_SILENCE_MS,
  QUICK_CAPTURE_MAX_SECONDS,
  SPEAKING_VOLUME_THRESHOLD,
  SPEECH_TEXT_GRACE_MS,
} from '../constants/voice.constants';
import type {
  CapturedPlan,
  VoiceCaptureFailureReason,
  VoiceCaptureState,
  VoicePauseCause,
} from '../schemas/voice-capture.schema';
import type { SpeechResult, VoiceTranscript } from '../schemas/voice-transcript.schema';
import { VoiceTranscriptPolicy } from './voice-transcript.model';

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

function createVoiceCaptureState(): VoiceCaptureState {
  return {
    status: 'idle',
    transcript: VoiceTranscriptPolicy.createVoiceTranscript(),
    elapsedMs: 0,
    pauseCount: 0,
  };
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
    transcript: VoiceTranscriptPolicy.withInterimFinalized(segment.transcript),
    status: 'failed',
    reason,
  };
}

/** 결과 없이 끝나면 서버를 부르지 않는다 */
function toFinalized(state: VoiceCaptureState): VoiceCaptureState {
  const { elapsedMs, pauseCount } = state;
  const transcript = VoiceTranscriptPolicy.withInterimFinalized(state.transcript);
  return {
    transcript,
    elapsedMs,
    pauseCount,
    status: VoiceTranscriptPolicy.isTranscriptEmpty(transcript) ? 'idle' : 'planning',
  };
}

/**
 * Android 인식기는 stop 뒤에 마지막 결과 대신 ERROR_CLIENT를 줄 수 있고, 어느 쪽이든 이어서 end가 온다.
 * 앱이 스스로 멈춘 구간의 client는 실패가 아니라 정상 종료이고, 글자 확정은 end가 맡는다.
 */
interface RecognizerError {
  code: SpeechErrorCode;
  /** 이 구간은 앱이 이미 stop을 불렀다 */
  isStopRequested?: boolean;
}

function isStopAcknowledgement(
  state: VoiceCaptureState,
  { code, isStopRequested = false }: RecognizerError,
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

function isRecognizerFailure(state: VoiceCaptureState, error: RecognizerError): boolean {
  return RECOGNIZER_FAILURE_CODES.has(error.code) && !isStopAcknowledgement(state, error);
}

function reduceVoiceCapture(state: VoiceCaptureState, event: VoiceCaptureEvent): VoiceCaptureState {
  return (
    match([state, event] as const)
      .returnType<VoiceCaptureState>()
      .with([{ status: 'idle' }, { type: 'prepare' }], ([current, { seed }]) => ({
        ...current,
        ...seed,
        status: 'preparing',
      }))
      .with([{ status: P.union('paused', 'failed') }, { type: 'resume' }], ([current]) => ({
        transcript: VoiceTranscriptPolicy.withInterimFinalized(current.transcript),
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
          transcript: VoiceTranscriptPolicy.applyResult(current.transcript, result),
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
        transcript: VoiceTranscriptPolicy.withInterimFinalized(current.transcript),
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
              isStopAcknowledgement(current, { code, isStopRequested })
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

function isActive(state: VoiceCaptureState): boolean {
  return (
    state.status === 'preparing' ||
    state.status === 'listening' ||
    state.status === 'paused' ||
    state.status === 'finalizing'
  );
}

/** 음성이 돌지 않고 계획도 없어 손으로 입력하는 때 */
function isManualInput(state: Pick<VoiceCaptureState, 'status'>): boolean {
  return state.status === 'idle' || state.status === 'failed';
}

function isWrappingUp(state: VoiceCaptureState): boolean {
  return state.status === 'finalizing' || state.status === 'planning';
}

function canFinish(state: VoiceCaptureState): boolean {
  const isStopped =
    state.status === 'paused' || (state.status === 'failed' && state.reason !== 'planning-failed');
  return (
    (state.status === 'listening' || isStopped) &&
    !VoiceTranscriptPolicy.isTranscriptEmpty(state.transcript)
  );
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
    !VoiceTranscriptPolicy.isTranscriptEmpty(state.transcript)
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

/** 일시정지를 지나도 앞서 들은 시간을 뺀 만큼만 더 듣는다 */
function getRemainingCaptureMs(state: VoiceCaptureState, maxSeconds: number, now: number): number {
  return Math.max(0, maxSeconds * SECOND_MS - getElapsedMs(state, now));
}

function shouldOfferVoiceNote(state: VoiceCaptureState): boolean {
  return state.status === 'paused' && state.elapsedMs >= QUICK_CAPTURE_MAX_SECONDS * SECOND_MS;
}

/**
 * 인식기에 줄 힌트를 정한다. 흔한 단어는 늘 주고, 내 카테고리·할 일 이름은 기기 안 인식일 때만 앞에 둔다.
 * 네트워크 인식이면 음성 인식 서비스로 나가므로 개인 단어를 비운다. 어댑터를 바꿔도 이 규칙은 남는다.
 */
function getRecognizerStartOptions(options: SpeechStartOptions): SpeechStartOptions {
  const commonHints = COMMON_SPEECH_HINTS[options.locale];

  return {
    ...options,
    hintWords: options.isOnDevice ? uniq([...options.hintWords, ...commonHints]) : [...commonHints],
  };
}

export const VoiceCapturePolicy = {
  isRecognizerFailure,
  getRemainingCaptureMs,
  shouldRestartSegment,
  isActive,
  isManualInput,
  isWrappingUp,
  canFinish,
  canResume,
  canResumeWithinLimit,
  canRetryPlanning,
  shouldAutoFinish,
  isSpeaking,
  shouldOfferVoiceNote,
  getDismissAction,
  isChargedReview,
  getElapsedMs,
  createVoiceCaptureState,
  reduceVoiceCapture,
  getRecognizerStartOptions,
} as const;

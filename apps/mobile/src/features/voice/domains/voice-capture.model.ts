import { SPEECH_ERROR_CODES, type SpeechErrorCode } from '@src/core/ports/speech-recognizer';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { voicePlanSchema } from './voice-plan.model';
import {
  createVoiceTranscript,
  type SpeechResult,
  type VoiceTranscript,
  VoiceTranscriptPolicy,
  voiceTranscriptSchema,
} from './voice-transcript.model';

const voiceCaptureFailureReasonSchema = z.enum([...SPEECH_ERROR_CODES, 'planning-failed']);
export type VoiceCaptureFailureReason = z.infer<typeof voiceCaptureFailureReasonSchema>;

const voicePauseCauseSchema = z.enum(['app-background', 'interrupted', 'user', 'limit']);
export type VoicePauseCause = z.infer<typeof voicePauseCauseSchema>;

const captureBaseSchema = z.object({
  transcript: voiceTranscriptSchema,
  // 이미 끝난 듣기 구간들의 합(ms)
  elapsedMs: z.int().nonnegative(),
  pauseCount: z.int().nonnegative(),
});

const capturedPlanSchema = z.object({
  plan: voicePlanSchema,
  isCharged: z.boolean(),
});
export type CapturedPlan = z.infer<typeof capturedPlanSchema>;

// 어느 상태에서도 들은 글자(transcript)는 지우지 않는다
export const voiceCaptureStateSchema = z.discriminatedUnion('status', [
  captureBaseSchema.extend({ status: z.literal('idle') }),
  captureBaseSchema.extend({ status: z.literal('preparing') }),
  captureBaseSchema.extend({ status: z.literal('listening'), listeningSince: z.number() }),
  captureBaseSchema.extend({ status: z.literal('paused'), cause: voicePauseCauseSchema }),
  captureBaseSchema.extend({ status: z.literal('finalizing') }),
  captureBaseSchema.extend({ status: z.literal('planning') }),
  captureBaseSchema.extend(capturedPlanSchema.shape).extend({ status: z.literal('review') }),
  captureBaseSchema.extend({
    status: z.literal('failed'),
    reason: voiceCaptureFailureReasonSchema,
  }),
]);
export type VoiceCaptureState = z.infer<typeof voiceCaptureStateSchema>;

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
  return {
    status: 'idle',
    transcript: createVoiceTranscript(),
    elapsedMs: 0,
    pauseCount: 0,
  };
}

export function getElapsedMs(state: VoiceCaptureState, now: number): number {
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

// 결과 없이 끝나면 서버를 부르지 않는다
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

// Android 인식기는 stop 뒤 마지막 결과 대신 ERROR_CLIENT를 주기도 해 앱이 멈춘 구간의 client는 정상 종료로 본다
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

export function isRecognizerFailure(state: VoiceCaptureState, error: RecognizerError): boolean {
  return RECOGNIZER_FAILURE_CODES.has(error.code) && !isStopAcknowledgement(state, error);
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

// 듣기가 끝났는데 사용자가 끝내지 않았다면(침묵·인식기 제한 시간) 같은 세션을 다시 연다
export function shouldRestartSegment(state: VoiceCaptureState): boolean {
  return state.status === 'listening';
}

export function isActive(state: VoiceCaptureState): boolean {
  return (
    state.status === 'preparing' ||
    state.status === 'listening' ||
    state.status === 'paused' ||
    state.status === 'finalizing'
  );
}

// 음성이 돌지 않고 계획도 없어 손으로 입력하는 때
export function isManualInput(state: VoiceCaptureState): boolean {
  return state.status === 'idle' || state.status === 'failed';
}

export function isWrappingUp(state: VoiceCaptureState): boolean {
  return state.status === 'finalizing' || state.status === 'planning';
}

export function canFinish(state: VoiceCaptureState): boolean {
  const isStopped =
    state.status === 'paused' || (state.status === 'failed' && state.reason !== 'planning-failed');
  return (
    (state.status === 'listening' || isStopped) &&
    !VoiceTranscriptPolicy.isTranscriptEmpty(state.transcript)
  );
}

export function canResume(state: VoiceCaptureState): boolean {
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

export function canResumeWithinLimit(state: VoiceCaptureState, limitMs: number | null): boolean {
  return canResume(state) && (limitMs == null || state.elapsedMs < limitMs);
}

export function canRetryPlanning(state: VoiceCaptureState): boolean {
  return (
    state.status === 'failed' &&
    state.reason === 'planning-failed' &&
    !VoiceTranscriptPolicy.isTranscriptEmpty(state.transcript)
  );
}

export function shouldAutoFinish(
  state: VoiceCaptureState,
  silentMs: number,
  silenceLimitMs: number,
): boolean {
  return canFinish(state) && silentMs >= silenceLimitMs;
}

type VoiceDismissAction = 'cancel-capture' | 'cancel-planning' | 'confirm-discard';

// 시트의 바깥 탭과 Android 뒤로 가기. 듣기·정리는 X와 같고, 고를 카드가 있으면 계획을 잃기 전에 묻는다. null이면 시트가 닫힌다
export function getDismissAction(state: VoiceCaptureState): VoiceDismissAction | null {
  return match(state)
    .returnType<VoiceDismissAction | null>()
    .with({ status: 'review' }, ({ plan }) =>
      plan.actions.length === 0 ? null : 'confirm-discard',
    )
    .with({ status: 'planning' }, () => 'cancel-planning')
    .when(isActive, () => 'cancel-capture')
    .otherwise(() => null);
}

// 차감된 계획을 고르는 단계인지. 떠나면 이미 쓴 횟수를 잃는다
export function isChargedReview(state: VoiceCaptureState): boolean {
  return state.status === 'review' && state.isCharged;
}

// 일시정지를 지나도 앞서 들은 시간을 뺀 만큼만 더 듣는다
export function getRemainingCaptureMs(
  state: VoiceCaptureState,
  maxSeconds: number,
  now: number,
): number {
  return Math.max(0, maxSeconds * SECOND_MS - getElapsedMs(state, now));
}

// 빠른 말하기의 한 번 길이를 다 썼다. 멈춘 원인과 무관하게 이어 들을 시간이 없어 말로 메모하기로 넘긴다
export function shouldOfferVoiceNote(state: VoiceCaptureState, maxSeconds: number): boolean {
  return state.status === 'paused' && state.elapsedMs >= maxSeconds * SECOND_MS;
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
  shouldOfferVoiceNote,
  getDismissAction,
  isChargedReview,
  getElapsedMs,
  reduceVoiceCapture,
} as const;

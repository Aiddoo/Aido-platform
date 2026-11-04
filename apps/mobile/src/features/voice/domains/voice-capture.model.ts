import { SPEECH_ERROR_CODES, type SpeechErrorCode } from '@src/core/ports/speech-recognizer';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { AUTO_FINISH_SILENCE_MS, QUICK_CAPTURE_MAX_SECONDS } from '../constants/voice.constants';
import {
  applyResult,
  createVoiceTranscript,
  isTranscriptEmpty,
  type SpeechResult,
  voiceTranscriptSchema,
  withInterimFinalized,
} from './voice-transcript.model';

export const VOICE_CAPTURE_FAILURE_REASONS = [...SPEECH_ERROR_CODES, 'planning-failed'] as const;
export const voiceCaptureFailureReasonSchema = z.enum(VOICE_CAPTURE_FAILURE_REASONS);
export type VoiceCaptureFailureReason = z.infer<typeof voiceCaptureFailureReasonSchema>;

export const VOICE_PAUSE_CAUSES = ['app-background', 'interrupted'] as const;
export const voicePauseCauseSchema = z.enum(VOICE_PAUSE_CAUSES);
export type VoicePauseCause = z.infer<typeof voicePauseCauseSchema>;

const captureBaseSchema = z.object({
  transcript: voiceTranscriptSchema,
  /** 이미 끝난 듣기 구간들의 합(ms) */
  elapsedMs: z.int().nonnegative(),
  pauseCount: z.int().nonnegative(),
});

/**
 * 빠른 말하기 한 번의 진행 상태. 어느 상태에서도 들은 글자(transcript)는 지우지 않는다.
 * 계획 카드(review)는 계획 API가 생기는 층에서 이어 붙인다.
 */
export const voiceCaptureStateSchema = z.discriminatedUnion('status', [
  captureBaseSchema.extend({ status: z.literal('idle') }),
  captureBaseSchema.extend({ status: z.literal('preparing') }),
  captureBaseSchema.extend({ status: z.literal('listening'), listeningSince: z.number() }),
  captureBaseSchema.extend({ status: z.literal('paused'), cause: voicePauseCauseSchema }),
  captureBaseSchema.extend({ status: z.literal('finalizing') }),
  captureBaseSchema.extend({ status: z.literal('planning') }),
  captureBaseSchema.extend({
    status: z.literal('failed'),
    reason: voiceCaptureFailureReasonSchema,
  }),
]);
export type VoiceCaptureState = z.infer<typeof voiceCaptureStateSchema>;

export type VoiceCaptureEvent =
  | { type: 'prepare' }
  | { type: 'start'; at: number }
  | { type: 'result'; result: SpeechResult }
  | { type: 'pause'; cause: VoicePauseCause; at: number }
  | { type: 'resume' }
  | { type: 'finish'; at: number }
  | { type: 'end' }
  | { type: 'error'; code: SpeechErrorCode; at: number }
  | { type: 'planned' }
  | { type: 'plan-failed' }
  | { type: 'retry-plan' }
  | { type: 'cancel' };

export function createVoiceCaptureState(): VoiceCaptureState {
  return { status: 'idle', transcript: createVoiceTranscript(), elapsedMs: 0, pauseCount: 0 };
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

export function reduceVoiceCapture(
  state: VoiceCaptureState,
  event: VoiceCaptureEvent,
): VoiceCaptureState {
  return match([state, event] as const)
    .returnType<VoiceCaptureState>()
    .with([{ status: 'idle' }, { type: 'prepare' }], ([current]) => ({
      ...current,
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
    .with([{ status: 'listening' }, { type: 'finish' }], ([current, { at }]) => ({
      ...toFinishedSegment(current, at),
      status: 'finalizing',
    }))
    .with([{ status: 'paused' }, { type: 'finish' }], ([current]) => toFinalized(current))
    .with([{ status: 'finalizing' }, { type: 'end' }], ([current]) => toFinalized(current))
    .with(
      [{ status: P.union('preparing', 'listening', 'finalizing') }, { type: 'error' }],
      ([current, { code, at }]) =>
        match(code)
          .returnType<VoiceCaptureState>()
          .with('no-speech', 'speech-timeout', 'aborted', () => current)
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
    .with([{ status: 'planning' }, { type: 'planned' }], () => createVoiceCaptureState())
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
    .otherwise(([current]) => current);
}

/** 듣기가 끝났는데 사용자가 끝내지 않았다면(침묵·인식기 제한 시간) 같은 세션을 다시 연다 */
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

export function canFinish(state: VoiceCaptureState): boolean {
  return (
    (state.status === 'listening' || state.status === 'paused') &&
    !isTranscriptEmpty(state.transcript)
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

export function canRetryPlanning(state: VoiceCaptureState): boolean {
  return (
    state.status === 'failed' &&
    state.reason === 'planning-failed' &&
    !isTranscriptEmpty(state.transcript)
  );
}

export function shouldAutoFinish(
  state: VoiceCaptureState,
  silentMs: number,
  silenceLimitMs: number = AUTO_FINISH_SILENCE_MS,
): boolean {
  return canFinish(state) && silentMs >= silenceLimitMs;
}

export function isOverQuickLimit(
  state: VoiceCaptureState,
  now: number,
  maxSeconds: number = QUICK_CAPTURE_MAX_SECONDS,
): boolean {
  return getElapsedMs(state, now) >= maxSeconds * 1_000;
}

export function getRemainingSeconds(
  state: VoiceCaptureState,
  maxSeconds: number,
  now: number,
): number {
  return Math.max(0, Math.ceil(maxSeconds - getElapsedMs(state, now) / 1_000));
}

export const VoiceCapturePolicy = {
  shouldRestartSegment,
  isActive,
  canFinish,
  canResume,
  canRetryPlanning,
  shouldAutoFinish,
  isOverQuickLimit,
  getElapsedMs,
  getRemainingSeconds,
} as const;

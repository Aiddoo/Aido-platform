import { SPEECH_ERROR_CODES, type SpeechErrorCode } from '@src/core/ports/speech-recognizer';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import {
  AUTO_FINISH_SILENCE_MS,
  QUICK_CAPTURE_MAX_SECONDS,
  SPEAKING_VOLUME_THRESHOLD,
  SPEECH_TEXT_GRACE_MS,
  VOICE_STALL_RESTART,
} from '../constants/voice.constants';
import { voicePlanSchema } from './voice-plan.model';
import {
  applyResult,
  createVoiceTranscript,
  isTranscriptEmpty,
  type SpeechResult,
  type VoiceTranscript,
  voiceTranscriptSchema,
  withInterimFinalized,
} from './voice-transcript.model';

export const VOICE_CAPTURE_FAILURE_REASONS = [...SPEECH_ERROR_CODES, 'planning-failed'] as const;
export const voiceCaptureFailureReasonSchema = z.enum(VOICE_CAPTURE_FAILURE_REASONS);
export type VoiceCaptureFailureReason = z.infer<typeof voiceCaptureFailureReasonSchema>;

export const VOICE_PAUSE_CAUSES = ['app-background', 'interrupted', 'user', 'limit'] as const;
export const voicePauseCauseSchema = z.enum(VOICE_PAUSE_CAUSES);
export type VoicePauseCause = z.infer<typeof voicePauseCauseSchema>;

const captureBaseSchema = z.object({
  transcript: voiceTranscriptSchema,
  /** 이미 끝난 듣기 구간들의 합(ms) */
  elapsedMs: z.int().nonnegative(),
  pauseCount: z.int().nonnegative(),
});

export const capturedPlanSchema = z.object({
  plan: voicePlanSchema,
  /** 이 요청으로 횟수를 썼는지. false면 "횟수는 차감되지 않아요"를 보여 준다 */
  isCharged: z.boolean(),
});
export type CapturedPlan = z.infer<typeof capturedPlanSchema>;

/** 말하기 한 번의 진행 상태. 어느 상태에서도 들은 글자(transcript)는 지우지 않는다 */
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

/**
 * Android 인식기는 stop 뒤에 마지막 결과 대신 ERROR_CLIENT를 줄 수 있고, 어느 쪽이든 이어서 end가 온다.
 * 앱이 스스로 멈춘 구간의 client는 실패가 아니라 정상 종료이고, 글자 확정은 end가 맡는다.
 */
export function isStopAcknowledgement(
  state: VoiceCaptureState,
  code: SpeechErrorCode,
  isStopRequested: boolean = false,
): boolean {
  return (
    code === 'client' &&
    (isStopRequested || state.status === 'finalizing' || state.status === 'paused')
  );
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
export function shouldRestartSegment(state: VoiceCaptureState): boolean {
  return state.status === 'listening';
}

export const voiceStallWatchSchema = z.object({
  /** 마지막 글자를 받았거나 구간이 열린 시각 */
  lastTextAt: z.number(),
  /** 그 뒤로 말소리 크기로 들린 시간의 합(ms) */
  voicedMs: z.number().nonnegative(),
  lastSampleAt: z.number().nullable(),
  /** 마지막 음량이 말소리 크기였다. 조용할 때는 다시 열지 않는다 */
  isVoiceAudible: z.boolean(),
  /** 글자 없이 다시 연 시각. 글자가 오면 인식기가 살아난 것이라 지운다 */
  lastRestartAt: z.number().nullable(),
});
export type VoiceStallWatch = z.infer<typeof voiceStallWatchSchema>;

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

export function shouldRestartStalledRecognizer(
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

export function isActive(state: VoiceCaptureState): boolean {
  return (
    state.status === 'preparing' ||
    state.status === 'listening' ||
    state.status === 'paused' ||
    state.status === 'finalizing'
  );
}

export function isWrappingUp(state: VoiceCaptureState): boolean {
  return state.status === 'finalizing' || state.status === 'planning';
}

export function canFinish(state: VoiceCaptureState): boolean {
  const isStopped =
    state.status === 'paused' || (state.status === 'failed' && state.reason !== 'planning-failed');
  return (state.status === 'listening' || isStopped) && !isTranscriptEmpty(state.transcript);
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
    !isTranscriptEmpty(state.transcript)
  );
}

export function isSpeaking(level: number, lastTextAt: number | null, now: number): boolean {
  return (
    level >= SPEAKING_VOLUME_THRESHOLD &&
    (lastTextAt == null || now - lastTextAt < SPEECH_TEXT_GRACE_MS)
  );
}

export function shouldAutoFinish(
  state: VoiceCaptureState,
  silentMs: number,
  silenceLimitMs: number = AUTO_FINISH_SILENCE_MS,
): boolean {
  return canFinish(state) && silentMs >= silenceLimitMs;
}

export type VoiceDismissAction = 'cancel-capture' | 'cancel-planning' | 'confirm-discard';

/** 시트의 바깥 탭과 Android 뒤로 가기. 듣기·정리는 X와 같고, 고를 카드가 있으면 계획을 잃기 전에 묻는다. null이면 시트가 닫힌다 */
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

export function isOverQuickLimit(
  state: VoiceCaptureState,
  now: number,
  maxSeconds: number = QUICK_CAPTURE_MAX_SECONDS,
): boolean {
  return getElapsedMs(state, now) >= maxSeconds * 1_000;
}

export function shouldOfferVoiceNote(state: VoiceCaptureState, now: number): boolean {
  return state.status === 'paused' && isOverQuickLimit(state, now);
}

export const VoiceCapturePolicy = {
  isStopAcknowledgement,
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
  getElapsedMs,
} as const;

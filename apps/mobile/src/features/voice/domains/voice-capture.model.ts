import { SPEECH_ERROR_CODES, type SpeechErrorCode } from '@src/core/ports/speech-recognizer';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

import {
  AUTO_FINISH_SILENCE_MS,
  QUICK_CAPTURE_MAX_SECONDS,
  SPEAKING_VOLUME_THRESHOLD,
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

/** 계획을 받아 고르는 단계로 넘어갈 때 함께 드는 값 */
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
  /** 이어 받을 글자와 시간이 있으면(빠른 말하기에서 넘어옴) 거기서부터 듣는다 */
  | { type: 'prepare'; seed?: VoiceCaptureSeed }
  | { type: 'start'; at: number }
  | { type: 'result'; result: SpeechResult }
  | { type: 'pause'; cause: VoicePauseCause; at: number }
  | { type: 'resume' }
  | { type: 'finish'; at: number }
  | { type: 'end' }
  /** `isStopRequested`: 이 구간은 앱이 이미 stop을 불렀다 */
  | { type: 'error'; code: SpeechErrorCode; at: number; isStopRequested?: boolean }
  /** 글자를 넘겨받은 쪽이 일을 마쳤다. 고를 계획이 있으면 review로, 없으면 처음으로 돌아간다 */
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

/** 인식기가 멈췄는지 보려고 듣는 구간마다 모으는 값 */
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

/** 듣는 중인데 말소리가 지금 들리고, 그만큼 들었는데도 일정 시간 글자가 없다 */
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

/** 듣기를 끝내고 글자를 마무리하거나 정리하는 중이다. 이때는 닫거나 되돌릴 수 없다 */
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

/** 한 번에 들을 수 있는 길이가 정해져 있으면 그 안에서만 이어 듣는다. 길이 제한이 없으면 null이다 */
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

/** 빠른 말하기 길이를 다 써서 멈췄다. 들은 글자를 정리하거나 말로 메모하기로 이어 가게 한다 */
export function shouldOfferVoiceNote(state: VoiceCaptureState, now: number): boolean {
  return state.status === 'paused' && isOverQuickLimit(state, now);
}

export function getRemainingSeconds(
  state: VoiceCaptureState,
  maxSeconds: number,
  now: number,
): number {
  return Math.max(0, Math.ceil(maxSeconds - getElapsedMs(state, now) / 1_000));
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
  isOverQuickLimit,
  shouldOfferVoiceNote,
  getElapsedMs,
  getRemainingSeconds,
} as const;

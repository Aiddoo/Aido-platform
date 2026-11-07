import { SPEECH_ERROR_CODES } from '@src/core/ports/speech-recognizer';
import { z } from 'zod';

import { voicePlanSchema } from './voice-plan.schema';
import { voiceTranscriptSchema } from './voice-transcript.schema';

const VOICE_CAPTURE_FAILURE_REASONS = [...SPEECH_ERROR_CODES, 'planning-failed'] as const;
const voiceCaptureFailureReasonSchema = z.enum(VOICE_CAPTURE_FAILURE_REASONS);
export type VoiceCaptureFailureReason = z.infer<typeof voiceCaptureFailureReasonSchema>;

const VOICE_PAUSE_CAUSES = ['app-background', 'interrupted', 'user', 'limit'] as const;
const voicePauseCauseSchema = z.enum(VOICE_PAUSE_CAUSES);
export type VoicePauseCause = z.infer<typeof voicePauseCauseSchema>;

const captureBaseSchema = z.object({
  transcript: voiceTranscriptSchema,
  /** 이미 끝난 듣기 구간들의 합(ms) */
  elapsedMs: z.int().nonnegative(),
  pauseCount: z.int().nonnegative(),
});

const capturedPlanSchema = z.object({
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

const voiceStallWatchSchema = z.object({
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

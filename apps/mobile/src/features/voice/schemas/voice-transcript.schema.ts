import { z } from 'zod';

/**
 * 인식기가 주는 글자를 한 모양으로 모은다.
 * - Android는 문장마다 final이 오고 이후 결과는 새 문장이다.
 * - iOS는 interim이 지금까지 한 말 전체로 쌓이다가 끝에 final 하나가 온다.
 * 두 경우 모두 "interim은 꼬리를 통째로 바꾸고, final은 문장으로 확정한다"로 흡수한다.
 */
export const voiceTranscriptSchema = z.object({
  sentences: z.array(z.string().min(1)),
  interim: z.string(),
});
export type VoiceTranscript = z.infer<typeof voiceTranscriptSchema>;

const speechResultSchema = z.object({
  transcript: z.string(),
  isFinal: z.boolean(),
});
export type SpeechResult = z.infer<typeof speechResultSchema>;

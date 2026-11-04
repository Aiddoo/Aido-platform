import type { SpeechSegment } from '@src/core/ports/speech-recognizer';
import { z } from 'zod';

import { LOW_CONFIDENCE_THRESHOLD } from '../constants/voice.constants';

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

export const speechResultSchema = z.object({
  transcript: z.string(),
  isFinal: z.boolean(),
});
export type SpeechResult = z.infer<typeof speechResultSchema>;

export function createVoiceTranscript(overrides: Partial<VoiceTranscript> = {}): VoiceTranscript {
  return { sentences: [], interim: '', ...overrides };
}

export function replaceInterimResult(transcript: VoiceTranscript, text: string): VoiceTranscript {
  return { ...transcript, interim: text.trim() };
}

export function appendFinalResult(transcript: VoiceTranscript, text: string): VoiceTranscript {
  const sentence = text.trim();
  if (sentence.length === 0) {
    return { ...transcript, interim: '' };
  }
  if (transcript.sentences.at(-1) === sentence) {
    return { ...transcript, interim: '' };
  }
  return { sentences: [...transcript.sentences, sentence], interim: '' };
}

export function applyResult(transcript: VoiceTranscript, result: SpeechResult): VoiceTranscript {
  return result.isFinal
    ? appendFinalResult(transcript, result.transcript)
    : replaceInterimResult(transcript, result.transcript);
}

/** 확정된 글자. 화면에서 진하게 그린다 */
export function getFinalText(transcript: VoiceTranscript): string {
  return transcript.sentences.join(' ');
}

/** 아직 인식 중인 꼬리 */
export function getInterimText(transcript: VoiceTranscript): string {
  return transcript.interim;
}

/** 서버로 보내거나 입력칸에 넣을 전체 글자 */
export function getTranscriptText(transcript: VoiceTranscript): string {
  return [getFinalText(transcript), transcript.interim].filter((part) => part.length > 0).join(' ');
}

export function isTranscriptEmpty(transcript: VoiceTranscript): boolean {
  return getTranscriptText(transcript).length === 0;
}

/** 멈춘 뒤 남은 꼬리를 확정해 잃지 않게 한다 */
export function withInterimFinalized(transcript: VoiceTranscript): VoiceTranscript {
  return appendFinalResult(transcript, transcript.interim);
}

/**
 * 잘못 들었을 수 있는 단어(밑줄용). 신뢰도를 주지 않는 기기는 0 이하(Android -1, iOS 중간 결과 0)라
 * 아무것도 고르지 않는다.
 */
export function getLowConfidenceWords(
  segments: readonly SpeechSegment[],
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): string[] {
  return segments
    .filter(({ confidence }) => confidence > 0 && confidence < threshold)
    .map(({ text }) => text.trim())
    .filter((text) => text.length > 0);
}

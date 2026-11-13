import type { SpeechSegment } from '@src/core/ports/speech-recognizer';
import { compact } from 'es-toolkit';
import { z } from 'zod';

const LOW_CONFIDENCE_THRESHOLD = 0.5;

// Android는 문장마다 final, iOS는 interim이 쌓이다 끝에 final 하나. interim은 꼬리를 바꾸고 final은 문장으로 확정한다
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

// 빈 받아쓰기에서 시작하고 이어 받는 곳(노트 복원·예시 화면)은 일부 값만 넘긴다
export function createVoiceTranscript(overrides: Partial<VoiceTranscript> = {}): VoiceTranscript {
  return { sentences: [], interim: '', ...overrides };
}

function replaceInterimResult(transcript: VoiceTranscript, text: string): VoiceTranscript {
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

export function getFinalText(transcript: VoiceTranscript): string {
  return transcript.sentences.join(' ');
}

export function getTranscriptText(transcript: VoiceTranscript): string {
  return compact([getFinalText(transcript), transcript.interim]).join(' ');
}

export function isTranscriptEmpty(transcript: VoiceTranscript): boolean {
  return getTranscriptText(transcript).length === 0;
}

// 친 글자는 지우지 않는다. 들은 글자가 칸에 이미 있으면 그대로, 이어 말해 늘었으면 늘어난 글자로 바꾼다
export function mergeHeardTextIntoTitle(transcript: VoiceTranscript, title: string): string {
  const typed = title.trim();
  const heard = getTranscriptText(transcript).trim();
  if (heard.length === 0 || typed.includes(heard)) {
    return title;
  }
  if (heard.startsWith(typed)) {
    return heard;
  }
  return `${typed} ${heard}`;
}

export function withInterimFinalized(transcript: VoiceTranscript): VoiceTranscript {
  return appendFinalResult(transcript, transcript.interim);
}

// 신뢰도를 주지 않는 기기는 0 이하(Android -1, iOS 중간 결과 0)라 고르지 않는다
export function getLowConfidenceWords(segments: readonly SpeechSegment[]): string[] {
  return compact(
    segments
      .filter(({ confidence }) => 0 < confidence && confidence < LOW_CONFIDENCE_THRESHOLD)
      .map(({ text }) => text.trim()),
  );
}

export const VoiceTranscriptPolicy = {
  getTranscriptText,
  getFinalText,
  mergeHeardTextIntoTitle,
  isTranscriptEmpty,
  appendFinalResult,
  applyResult,
  withInterimFinalized,
  getLowConfidenceWords,
} as const;

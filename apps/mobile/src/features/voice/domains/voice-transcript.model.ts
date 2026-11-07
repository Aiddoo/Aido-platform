import type { SpeechSegment } from '@src/core/ports/speech-recognizer';

import { LOW_CONFIDENCE_THRESHOLD } from '../constants/voice.constants';
import type { SpeechResult, VoiceTranscript } from '../schemas/voice-transcript.schema';

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

function getFinalText(transcript: VoiceTranscript): string {
  return transcript.sentences.join(' ');
}

export function getTranscriptText(transcript: VoiceTranscript): string {
  return [getFinalText(transcript), transcript.interim].filter((part) => part.length > 0).join(' ');
}

export function isTranscriptEmpty(transcript: VoiceTranscript): boolean {
  return getTranscriptText(transcript).length === 0;
}

/**
 * 들은 글자를 입력 칸의 글자 뒤에 합친다. 친 글자는 지우지 않는다.
 * 실패로 이미 옮긴 글자가 겹치지 않게, 칸에 들어 있으면 그대로 두고 이어 말해 늘어났으면 늘어난 글자로 바꾼다.
 */
export function mergeHeardTextIntoTitle(title: string, heardText: string): string {
  const typed = title.trim();
  const heard = heardText.trim();
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

export const VoiceTranscriptPolicy = {
  getTranscriptText,
  getFinalText,
  mergeHeardTextIntoTitle,
  isTranscriptEmpty,
} as const;

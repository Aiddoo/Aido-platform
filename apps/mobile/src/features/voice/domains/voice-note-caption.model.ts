import type { SpeechLocale, SpeechSegment } from '@src/core/ports/speech-recognizer';
import type { Instant } from '@src/shared/date/instant';
import { clamp, sumBy } from 'es-toolkit';

import { VOICE_NOTE_SENTENCE_MAX_LENGTH } from '../constants/voice-note.constants';
import {
  createVoiceNote,
  type VoiceNote,
  type VoiceNoteSentence,
  withSentences,
} from './voice-note.model';
import { getLowConfidenceWords, type VoiceTranscript } from './voice-transcript.model';

/** 아직 인식 중인 꼬리를 문장으로 나눈 것. 시작 시각은 그 문장을 처음 본 때다 */
interface ProvisionalSentence {
  text: string;
  startMs: number;
}

/**
 * 녹음 중 자막. 인식기가 플랫폼마다 다른 모양으로 주는 글자를 문장 카드 하나로 모은다.
 * - Android: 문장마다 final이 오고 이후 결과는 새 문장이다.
 * - iOS: interim이 지금까지 한 말 전체로 쌓이다가 끝에 final 하나만 오므로, 꼬리도 문장으로 나눠 저장해 앱이 꺼져도 남긴다.
 */
export interface VoiceNoteCaptions {
  sentences: readonly VoiceNoteSentence[];
  provisional: readonly ProvisionalSentence[];
  /** 중요 표시를 누른 시각(노트 시계) */
  bookmarksMs: readonly number[];
}

interface SpeechResultInput {
  transcript: string;
  isFinal: boolean;
  segments: readonly SpeechSegment[];
}

interface CaptionClock {
  /** 지금 시각(노트 시계) */
  nowMs: number;
  /** 지금 인식 구간이 시작된 시각. `segments`의 시각은 구간 기준이라 더한다 */
  segmentStartMs: number;
}

export function createVoiceNoteCaptions(): VoiceNoteCaptions {
  return { sentences: [], provisional: [], bookmarksMs: [] };
}

/** 문장부호에서 나누고, 부호가 없는 긴 말(문장부호를 못 넣는 인식기)은 띄어쓰기에서 끊는다 */
export function splitIntoSentences(
  text: string,
  maxLength: number = VOICE_NOTE_SENTENCE_MAX_LENGTH,
): string[] {
  const parts = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.flatMap((part) => {
    const pieces: string[] = [];
    let rest = part;
    while (rest.length > maxLength) {
      const lastSpace = rest.lastIndexOf(' ', maxLength);
      const cut = lastSpace > 0 ? lastSpace : maxLength;
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    return rest.length > 0 ? [...pieces, rest] : pieces;
  });
}

const removeSpaces = (text: string) => text.replace(/\s/g, '');

function findSegmentStartMs(segments: readonly SpeechSegment[], offset: number): number | null {
  let consumed = 0;
  for (const segment of segments) {
    consumed += removeSpaces(segment.text).length;
    if (offset < consumed) {
      return segment.startMs;
    }
  }
  return segments.at(-1)?.startMs ?? null;
}

function findSegmentsWithin(
  segments: readonly SpeechSegment[],
  fromOffset: number,
  toOffset: number,
): SpeechSegment[] {
  let consumed = 0;
  return segments.filter((segment) => {
    const startOffset = consumed;
    consumed += removeSpaces(segment.text).length;
    return startOffset >= fromOffset && startOffset < toOffset;
  });
}

function toTimedSentences(
  pieces: readonly string[],
  {
    fromMs,
    toMs,
    segments,
    segmentStartMs,
  }: {
    fromMs: number;
    toMs: number;
    segments: readonly SpeechSegment[];
    segmentStartMs: number;
  },
): VoiceNoteSentence[] {
  const total = sumBy(pieces, (piece) => removeSpaces(piece).length);
  let offset = 0;

  const ranges = pieces.map((piece) => {
    const segmentStart = findSegmentStartMs(segments, offset);
    const startMs =
      segmentStart == null
        ? fromMs + Math.round(((toMs - fromMs) * offset) / Math.max(total, 1))
        : segmentStartMs + segmentStart;
    const fromOffset = offset;
    offset += removeSpaces(piece).length;
    return { startMs, fromOffset, toOffset: offset };
  });

  return pieces.map((text, index) => {
    const range = ranges[index];
    const startMs = clamp(range?.startMs ?? fromMs, 0, toMs);
    return {
      text,
      startMs,
      endMs: Math.max(startMs, ranges[index + 1]?.startMs ?? toMs),
      isBookmarked: false,
      lowConfidenceWords: getLowConfidenceWords(
        findSegmentsWithin(segments, range?.fromOffset ?? 0, range?.toOffset ?? 0),
      ),
    };
  });
}

export function commitProvisional(captions: VoiceNoteCaptions, nowMs: number): VoiceNoteCaptions {
  if (captions.provisional.length === 0) {
    return captions;
  }
  const committed = captions.provisional.map(({ text, startMs }, index) => ({
    text,
    startMs,
    endMs: Math.max(startMs, captions.provisional[index + 1]?.startMs ?? nowMs),
    isBookmarked: false,
    lowConfidenceWords: [],
  }));

  return { ...captions, sentences: [...captions.sentences, ...committed], provisional: [] };
}

/** iOS는 긴 침묵 뒤에 interim을 처음부터 다시 쌓기도 한다. 이때 앞 글자를 잃지 않게 먼저 확정한다 */
function hasRestartedInterim(previous: readonly ProvisionalSentence[], next: string) {
  const previousText = previous.map(({ text }) => text).join(' ');
  return (
    previousText.length > 0 &&
    next.length < previousText.length / 2 &&
    !previousText.startsWith(next.slice(0, 8))
  );
}

function applyInterim(
  captions: VoiceNoteCaptions,
  transcript: string,
  nowMs: number,
): VoiceNoteCaptions {
  const base = hasRestartedInterim(captions.provisional, transcript)
    ? commitProvisional(captions, nowMs)
    : captions;

  return {
    ...base,
    provisional: splitIntoSentences(transcript).map((text, index) => ({
      text,
      startMs: base.provisional[index]?.startMs ?? nowMs,
    })),
  };
}

function applyFinal(
  captions: VoiceNoteCaptions,
  { transcript, segments }: SpeechResultInput,
  { nowMs, segmentStartMs }: CaptionClock,
): VoiceNoteCaptions {
  const pieces = splitIntoSentences(transcript);
  const lastCommitted = captions.sentences.at(-1)?.text;
  // 끝난 뒤 같은 문장을 한 번 더 주는 기기가 있다
  const fresh = pieces[0] === lastCommitted ? pieces.slice(1) : pieces;

  return {
    ...captions,
    provisional: [],
    sentences: [
      ...captions.sentences,
      ...toTimedSentences(fresh, {
        fromMs: captions.provisional[0]?.startMs ?? nowMs,
        toMs: nowMs,
        segments,
        segmentStartMs,
      }),
    ],
  };
}

export function applyCaptionResult(
  captions: VoiceNoteCaptions,
  result: SpeechResultInput,
  clock: CaptionClock,
): VoiceNoteCaptions {
  return result.isFinal
    ? applyFinal(captions, result, clock)
    : applyInterim(captions, result.transcript, clock.nowMs);
}

export function withBookmark(captions: VoiceNoteCaptions, nowMs: number): VoiceNoteCaptions {
  return { ...captions, bookmarksMs: [...captions.bookmarksMs, nowMs] };
}

/** 저장·표시할 문장 전체. 깃발은 그 시각에 말하고 있던 문장(말이 없었으면 직전 문장)에 붙는다 */
export function getCaptionSentences(
  captions: VoiceNoteCaptions,
  nowMs: number,
): VoiceNoteSentence[] {
  const { sentences } = commitProvisional(captions, nowMs);

  return sentences.map((sentence, index) => {
    const previousEnd = index === 0 ? Number.NEGATIVE_INFINITY : sentence.startMs;
    const nextStart = sentences[index + 1]?.startMs ?? Number.POSITIVE_INFINITY;
    return {
      ...sentence,
      isBookmarked: captions.bookmarksMs.some((ms) => previousEnd <= ms && ms < nextStart),
    };
  });
}

/** 중요 표시한 문장 수. 같은 문장을 여러 번 눌러도 하나고, 아직 문장이 없으면 곧 나올 첫 문장 하나에 붙는다 */
export function getMarkedSentenceCount(captions: VoiceNoteCaptions): number {
  const sentences = getCaptionSentences(captions, 0);
  if (sentences.length === 0) {
    return Math.min(captions.bookmarksMs.length, 1);
  }

  return sentences.filter(({ isBookmarked }) => isBookmarked).length;
}

/** 지울 때 물어봐야 할 글자가 있는지. 아직 확정되지 않은 꼬리도 들은 글자다 */
function hasCaptionText(captions: VoiceNoteCaptions): boolean {
  return captions.sentences.length > 0 || captions.provisional.length > 0;
}

export function getCaptionInterimText(captions: VoiceNoteCaptions): string {
  return captions.provisional.at(-1)?.text ?? '';
}

interface CreateVoiceNoteFromTranscriptInput {
  draftId: string;
  locale: SpeechLocale;
  createdAt: Instant;
  transcript: VoiceTranscript;
  durationMs: number;
}

/** 빠른 말하기에서 들은 글자로 초안을 만든다. 문장 시각은 모르므로 들은 시간에 글자 수만큼 나눈다 */
export function createVoiceNoteFromTranscript({
  draftId,
  locale,
  createdAt,
  transcript,
  durationMs,
}: CreateVoiceNoteFromTranscriptInput): VoiceNote {
  const pieces = [...transcript.sentences, transcript.interim].flatMap((text) =>
    splitIntoSentences(text),
  );

  return withSentences(
    createVoiceNote({ draftId, locale, createdAt }),
    toTimedSentences(pieces, { fromMs: 0, toMs: durationMs, segments: [], segmentStartMs: 0 }),
    durationMs,
  );
}

export function createCaptionsFromNote({ sentences }: VoiceNote): VoiceNoteCaptions {
  return {
    sentences,
    provisional: [],
    bookmarksMs: sentences.filter(({ isBookmarked }) => isBookmarked).map(({ startMs }) => startMs),
  };
}

export const VoiceNoteCaptionPolicy = {
  createVoiceNoteCaptions,
  createCaptionsFromNote,
  createVoiceNoteFromTranscript,
  splitIntoSentences,
  commitProvisional,
  applyCaptionResult,
  withBookmark,
  getCaptionSentences,
  getCaptionInterimText,
  getMarkedSentenceCount,
  hasCaptionText,
} as const;

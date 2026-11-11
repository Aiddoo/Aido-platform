import type { SpeechLocale, SpeechSegment } from '@src/core/ports/speech-recognizer';
import { type Instant } from '@src/shared/date/instant';
import { splitIntoSentences } from '@src/shared/utils/split-into-sentences';
import { clamp, isEqual, range, sumBy } from 'es-toolkit';

import { VOICE_NOTE_SENTENCE_MAX_LENGTH } from '../constants/voice-note.constants';
import { type VoiceNote, type VoiceNoteSentence, VoiceNotePolicy } from './voice-note.model';
import { type VoiceTranscript, VoiceTranscriptPolicy } from './voice-transcript.model';

/** 아직 인식 중인 꼬리를 문장으로 나눈 것. 시작 시각은 그 문장을 처음 본 때다 */
interface ProvisionalSentence {
  text: string;
  startMs: number;
}

// Android는 문장마다 final, iOS는 interim이 쌓이다 final 하나라 꼬리도 문장으로 나눠 앱이 꺼져도 남긴다
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

// 자막 카드 한 장의 글자 수를 넘지 않게 문장으로 나눈다
function splitIntoCaptionSentences(text: string): string[] {
  return splitIntoSentences(text, VOICE_NOTE_SENTENCE_MAX_LENGTH);
}

function removeSpaces(text: string) {
  return text.replace(/\s/g, '');
}

// 공백을 뺀 글자 수로 센 각 조각의 시작 위치
function getStartOffsets(texts: readonly string[]): number[] {
  return texts.map((_text, index) =>
    sumBy(texts.slice(0, index), (text) => removeSpaces(text).length),
  );
}

function findSegmentStartMs(segments: readonly SpeechSegment[], offset: number): number | null {
  const startOffsets = getStartOffsets(segments.map(({ text }) => text));
  const segment = segments.find(
    ({ text }, index) => offset < (startOffsets[index] ?? 0) + removeSpaces(text).length,
  );
  return (segment ?? segments.at(-1))?.startMs ?? null;
}

function findSegmentsWithin(
  segments: readonly SpeechSegment[],
  fromOffset: number,
  toOffset: number,
): SpeechSegment[] {
  const startOffsets = getStartOffsets(segments.map(({ text }) => text));
  return segments.filter((_segment, index) => {
    const startOffset = startOffsets[index] ?? 0;
    return fromOffset <= startOffset && startOffset < toOffset;
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
  const startOffsets = getStartOffsets(pieces);

  const ranges = pieces.map((piece, index) => {
    const offset = startOffsets[index] ?? 0;
    const segmentStart = findSegmentStartMs(segments, offset);
    const startMs =
      segmentStart == null
        ? fromMs + Math.round(((toMs - fromMs) * offset) / Math.max(total, 1))
        : segmentStartMs + segmentStart;
    return { startMs, fromOffset: offset, toOffset: offset + removeSpaces(piece).length };
  });

  return pieces.map((text, index) => {
    const range = ranges[index];
    const startMs = clamp(range?.startMs ?? fromMs, 0, toMs);
    return {
      text,
      startMs,
      endMs: Math.max(startMs, ranges[index + 1]?.startMs ?? toMs),
      isBookmarked: false,
      lowConfidenceWords: VoiceTranscriptPolicy.getLowConfidenceWords(
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

/** 다시 쌓인 interim이 이전보다 이 비율 아래로 짧고 앞 글자가 달라야 재시작으로 본다 */
const INTERIM_RESTART_LENGTH_RATIO = 0.5;
const INTERIM_RESTART_PREFIX_LENGTH = 8;

// iOS는 긴 침묵 뒤에 interim을 처음부터 다시 쌓기도 한다. 이때 앞 글자를 잃지 않게 먼저 확정한다
function hasRestartedInterim(previous: readonly ProvisionalSentence[], next: string) {
  const previousText = previous.map(({ text }) => text).join(' ');
  return (
    previousText.length > 0 &&
    next.length < previousText.length * INTERIM_RESTART_LENGTH_RATIO &&
    !previousText.startsWith(next.slice(0, INTERIM_RESTART_PREFIX_LENGTH))
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
    provisional: splitIntoCaptionSentences(transcript).map((text, index) => ({
      text,
      startMs: base.provisional[index]?.startMs ?? nowMs,
    })),
  };
}

// iOS 18은 멈출 때 마지막 말을 통째로 한 번 더 준다
function countRepeatedPieces(sentences: readonly VoiceNoteSentence[], pieces: readonly string[]) {
  const tail = sentences.slice(-pieces.length).map(({ text }) => removeSpaces(text));
  const heads = pieces.map(removeSpaces);

  return (
    range(Math.min(tail.length, heads.length), 0, -1).find((size) =>
      isEqual(tail.slice(-size), heads.slice(0, size)),
    ) ?? 0
  );
}

function applyFinal(
  captions: VoiceNoteCaptions,
  { transcript, segments }: SpeechResultInput,
  { nowMs, segmentStartMs }: CaptionClock,
): VoiceNoteCaptions {
  const pieces = splitIntoCaptionSentences(transcript);
  const fresh = pieces.slice(countRepeatedPieces(captions.sentences, pieces));

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

// 저장·표시할 문장 전체. 깃발은 그 시각에 말하고 있던 문장(말이 없었으면 직전 문장)에 붙는다
export function getCaptionSentences(
  captions: VoiceNoteCaptions,
  nowMs: number,
): VoiceNoteSentence[] {
  const { sentences } = commitProvisional(captions, nowMs);

  return sentences.map((sentence, index) => {
    const rangeStart = index === 0 ? Number.NEGATIVE_INFINITY : sentence.startMs;
    const nextStart = sentences[index + 1]?.startMs ?? Number.POSITIVE_INFINITY;
    return {
      ...sentence,
      isBookmarked: captions.bookmarksMs.some((ms) => rangeStart <= ms && ms < nextStart),
    };
  });
}

// 녹음 중 카드로 그릴 문장. 아직 바뀔 수 있는 마지막 문장은 빼고, 남은 문장은 그 다음 문장이 시작할 때 끝난다
export function getSettledSentences(captions: VoiceNoteCaptions): VoiceNoteSentence[] {
  const settling = captions.provisional.at(-1);

  return getCaptionSentences(
    { ...captions, provisional: captions.provisional.slice(0, -1) },
    settling?.startMs ?? 0,
  );
}

// 중요 표시한 문장 수. 같은 문장을 여러 번 눌러도 하나고, 아직 문장이 없으면 곧 나올 첫 문장 하나에 붙는다
export function getMarkedSentenceCount(captions: VoiceNoteCaptions): number {
  const sentences = getCaptionSentences(captions, 0);
  if (sentences.length === 0) {
    return Math.min(captions.bookmarksMs.length, 1);
  }

  return sentences.filter(({ isBookmarked }) => isBookmarked).length;
}

// 지울 때 물어봐야 할 글자가 있는지. 아직 확정되지 않은 꼬리도 들은 글자다
export function hasCaptionText(captions: VoiceNoteCaptions): boolean {
  return captions.sentences.length > 0 || captions.provisional.length > 0;
}

export function getCaptionInterimText(captions: VoiceNoteCaptions): string {
  return captions.provisional.at(-1)?.text ?? '';
}

interface CreateTranscribedVoiceNoteInput {
  draftId: string;
  locale: SpeechLocale;
  createdAt: Instant;
  transcript: VoiceTranscript;
  durationMs: number;
}

// 빠른 말하기에서 들은 글자로 초안을 만든다. 문장 시각은 모르므로 들은 시간에 글자 수만큼 나눈다
export function createTranscribedVoiceNote({
  draftId,
  locale,
  createdAt,
  transcript,
  durationMs,
}: CreateTranscribedVoiceNoteInput): VoiceNote {
  const pieces = [...transcript.sentences, transcript.interim].flatMap((text) =>
    splitIntoCaptionSentences(text),
  );

  return VoiceNotePolicy.withSentences(
    VoiceNotePolicy.createVoiceNote({ draftId, locale, createdAt }),
    toTimedSentences(pieces, { fromMs: 0, toMs: durationMs, segments: [], segmentStartMs: 0 }),
    durationMs,
  );
}

export function toVoiceNoteCaptions({ sentences }: VoiceNote): VoiceNoteCaptions {
  return {
    sentences,
    provisional: [],
    bookmarksMs: sentences.filter(({ isBookmarked }) => isBookmarked).map(({ startMs }) => startMs),
  };
}

export const VoiceNoteCaptionPolicy = {
  createVoiceNoteCaptions,
  toVoiceNoteCaptions,
  createTranscribedVoiceNote,
  commitProvisional,
  applyCaptionResult,
  withBookmark,
  getCaptionSentences,
  getSettledSentences,
  getCaptionInterimText,
  getMarkedSentenceCount,
  hasCaptionText,
} as const;

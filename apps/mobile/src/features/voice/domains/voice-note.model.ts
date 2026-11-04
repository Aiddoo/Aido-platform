import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { DAY_MS } from '@src/shared/utils/date-format';
import { z } from 'zod';

import { VOICE_NOTE_RETENTION_DAYS } from '../constants/voice-note.constants';

const SPEECH_LOCALES = ['ko-KR', 'en-US'] as const satisfies readonly SpeechLocale[];

/** 저장할 때는 ISO 문자열, 읽으면 `Date`다. 기기 저장소에는 순간만 ISO로 남긴다 */
const instantSchema = z.codec(z.iso.datetime(), z.date(), {
  decode: (iso) => new Date(iso),
  encode: (date) => date.toISOString(),
});

export const voiceNoteDraftIdSchema = z.string().min(1).brand<'VoiceNoteDraftId'>();
export type VoiceNoteDraftId = z.infer<typeof voiceNoteDraftIdSchema>;

/** 확정된 문장 하나. 녹음 시작부터의 구간이라 다시 듣기와 같은 시계를 쓴다 */
export const voiceNoteSentenceSchema = z.object({
  text: z.string(),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
  isBookmarked: z.boolean(),
});
export type VoiceNoteSentence = z.infer<typeof voiceNoteSentenceSchema>;

export const voiceNoteKeyPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  startMs: z.int().nonnegative(),
  isBookmarked: z.boolean(),
});
export type VoiceNoteKeyPoint = z.infer<typeof voiceNoteKeyPointSchema>;

export const voiceNoteDigestSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(voiceNoteKeyPointSchema),
});
export type VoiceNoteDigest = z.infer<typeof voiceNoteDigestSchema>;

/** 기기 안 초안. 녹음 파일은 폴더를 바꿔도 찾도록 파일 이름만 가진다 */
export const voiceNoteSchema = z.object({
  draftId: voiceNoteDraftIdSchema,
  locale: z.enum(SPEECH_LOCALES),
  createdAt: instantSchema,
  durationMs: z.int().nonnegative(),
  sentences: z.array(voiceNoteSentenceSchema),
  recordingFileName: z.string().min(1).nullable(),
  digest: voiceNoteDigestSchema.nullable(),
  appliedAt: instantSchema.nullable(),
});
export type VoiceNote = z.infer<typeof voiceNoteSchema>;

interface CreateVoiceNoteInput {
  draftId: string;
  locale: SpeechLocale;
  createdAt: Date;
}

export function createVoiceNote({ draftId, locale, createdAt }: CreateVoiceNoteInput): VoiceNote {
  return {
    draftId: voiceNoteDraftIdSchema.parse(draftId),
    locale,
    createdAt,
    durationMs: 0,
    sentences: [],
    recordingFileName: null,
    digest: null,
    appliedAt: null,
  };
}

export function withSentences(
  note: VoiceNote,
  sentences: readonly VoiceNoteSentence[],
  durationMs: number,
): VoiceNote {
  return { ...note, sentences: [...sentences], durationMs };
}

export function withRecordingFileName(
  note: VoiceNote,
  recordingFileName: string | null,
): VoiceNote {
  return { ...note, recordingFileName };
}

export function withDigest(note: VoiceNote, digest: VoiceNoteDigest): VoiceNote {
  return { ...note, digest };
}

export function withAppliedAt(note: VoiceNote, appliedAt: Date): VoiceNote {
  return { ...note, appliedAt };
}

/** 정리할 글자가 있고 아직 정리하지 않았다. 실패해서 다시 누르는 경우도 digest가 비어 있어 허용한다 */
export function canDigest(note: VoiceNote): boolean {
  return note.digest == null && note.sentences.some((sentence) => sentence.text.trim() !== '');
}

/** 다시 듣기 파일이 남아 있고 길이를 아는 노트. 파일이 실제로 있는지는 저장소가 확인한다 */
export function canPlayRecording(note: VoiceNote): boolean {
  return note.recordingFileName != null && note.durationMs > 0;
}

/** 재생 위치에서 말하고 있는 핵심 포인트. 첫 포인트 전이면 없다 */
export function findKeyPointAt(note: VoiceNote, positionMs: number): VoiceNoteKeyPoint | undefined {
  if (note.digest == null) {
    return undefined;
  }

  return note.digest.keyPoints
    .filter((keyPoint) => keyPoint.startMs <= positionMs)
    .reduce<VoiceNoteKeyPoint | undefined>(
      (latest, keyPoint) =>
        latest == null || keyPoint.startMs >= latest.startMs ? keyPoint : latest,
      undefined,
    );
}

const RETENTION_MS = VOICE_NOTE_RETENTION_DAYS * DAY_MS;

export function isExpired(note: VoiceNote, now: Date): boolean {
  return now.getTime() - note.createdAt.getTime() >= RETENTION_MS;
}

/** 어느 초안도 가리키지 않는 녹음 파일의 보관 기한. 수정 시각을 모르면 기한이 지난 것으로 본다 */
export function isRecordingFileExpired(modifiedAt: Date | null, now: Date): boolean {
  return modifiedAt == null || now.getTime() - modifiedAt.getTime() >= RETENTION_MS;
}

export const VoiceNotePolicy = {
  canDigest,
  canPlayRecording,
  findKeyPointAt,
  isExpired,
  isRecordingFileExpired,
} as const;

import { ACTION_PLAN_LIMITS, MEMO_LIMITS } from '@aido/api/vocabulary';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { DAY_MS } from '@src/shared/utils/date-format';
import { chunk } from 'es-toolkit';
import { z } from 'zod';

import {
  VOICE_NOTE_RETENTION_DAYS,
  VOICE_RECORDING_ORPHAN_RETENTION_DAYS,
} from '../constants/voice-note.constants';
import {
  type PlanReviewDraft,
  createPlanReviewDraft,
  planReviewDraftSchema,
} from './plan-review-form.schema';
import { isTodoAction, type PlannedMemo, type VoiceNoteDigestResult } from './voice-plan.model';

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
  /** 잘못 들었을 수 있는 단어(문장 안 순서대로). 신뢰도를 주지 않는 기기는 비어 있다 */
  lowConfidenceWords: z.array(z.string()).default([]),
});
export type VoiceNoteSentence = z.infer<typeof voiceNoteSentenceSchema>;

export const voiceNoteKeyPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** 말한 시각을 찾지 못한 포인트는 null이라 그 지점으로 갈 수 없다 */
  startMs: z.int().nonnegative().nullable(),
  isBookmarked: z.boolean(),
});
export type VoiceNoteKeyPoint = z.infer<typeof voiceNoteKeyPointSchema>;

export const voiceNoteDigestSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(voiceNoteKeyPointSchema),
});
export type VoiceNoteDigest = z.infer<typeof voiceNoteDigestSchema>;

/** 멈췄다 이어 들으면 인식기가 파일을 새로 쓴다. 한 조각은 노트 시계의 어디서 시작하는지 함께 든다 */
export const voiceNoteRecordingSchema = z.object({
  fileName: z.string().min(1),
  startMs: z.int().nonnegative(),
});
export type VoiceNoteRecording = z.infer<typeof voiceNoteRecordingSchema>;

/** 정리를 다시 보낼 때 차감이 겹치지 않도록 앱을 다시 켜도 같은 멱등 키를 쓴다 */
export const voiceNoteDigestRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
});
export type VoiceNoteDigestRequest = z.infer<typeof voiceNoteDigestRequestSchema>;

/** 고친 카드까지 든 검토 초안. 통째로 읽지 못하면 글자와 요약은 살리고 이 칸만 비워 화면이 알리게 한다 */
const storedPlanDraftSchema = z.codec(z.unknown(), z.custom<PlanReviewDraft | null>(), {
  decode: (raw) => planReviewDraftSchema.safeParse(raw).data ?? null,
  encode: (draft) => draft,
});

/** 기기 안 초안. 녹음 파일은 폴더를 바꿔도 찾도록 파일 이름만 가진다 */
export const voiceNoteSchema = z.object({
  draftId: voiceNoteDraftIdSchema,
  locale: z.enum(SPEECH_LOCALES),
  createdAt: instantSchema,
  durationMs: z.int().nonnegative(),
  sentences: z.array(voiceNoteSentenceSchema),
  recordings: z.array(voiceNoteRecordingSchema),
  digest: voiceNoteDigestSchema.nullable(),
  digestRequest: voiceNoteDigestRequestSchema.nullable(),
  planDraft: storedPlanDraftSchema,
  appliedAt: instantSchema.nullable(),
  memoSavedAt: instantSchema.nullable(),
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
    recordings: [],
    digest: null,
    digestRequest: null,
    planDraft: null,
    appliedAt: null,
    memoSavedAt: null,
  };
}

export function withSentences(
  note: VoiceNote,
  sentences: readonly VoiceNoteSentence[],
  durationMs: number,
): VoiceNote {
  return { ...note, sentences: [...sentences], durationMs };
}

export function withRecordings(
  note: VoiceNote,
  recordings: readonly VoiceNoteRecording[],
): VoiceNote {
  return { ...note, recordings: [...recordings] };
}

export function withDigestRequest(
  note: VoiceNote,
  digestRequest: VoiceNoteDigestRequest | null,
): VoiceNote {
  return { ...note, digestRequest };
}

export function withPlanDraft(note: VoiceNote, planDraft: PlanReviewDraft | null): VoiceNote {
  return { ...note, planDraft };
}

function isSentenceAtKeyPoint(sentence: VoiceNoteSentence, startMs: number) {
  return sentence.startMs <= startMs && startMs < sentence.endMs;
}

/** 정리 결과를 노트에 담는다. 서버가 돌려준 시각의 문장에 중요 표시가 있으면 핵심 포인트에 깃발을 옮긴다 */
export function withDigestResult(note: VoiceNote, result: VoiceNoteDigestResult): VoiceNote {
  const keyPoints = result.keyPoints.map(({ text, startMs }, index) => ({
    id: `key-point-${index + 1}`,
    text,
    startMs,
    isBookmarked:
      startMs != null &&
      note.sentences.some(
        (sentence) => sentence.isBookmarked && isSentenceAtKeyPoint(sentence, startMs),
      ),
  }));

  return {
    ...note,
    digest: { title: result.title, summary: result.summary, keyPoints },
    digestRequest: null,
    planDraft: createPlanReviewDraft(result.plan),
  };
}

export function withAppliedAt(note: VoiceNote, appliedAt: Date): VoiceNote {
  return { ...note, appliedAt, planDraft: null };
}

export function withMemoSavedAt(note: VoiceNote, memoSavedAt: Date): VoiceNote {
  return { ...note, memoSavedAt };
}

export interface VoiceNoteDigestInput {
  text: string;
  durationSeconds: number;
  segments: { startMs: number; text: string; isBookmarked: boolean }[];
}

/** 정리 요청. 문장이 서버 상한을 넘으면 이웃끼리 묶는다. 시각은 묶음의 첫 문장, 깃발은 하나라도 있으면 남긴다 */
export function createDigestInput(note: VoiceNote): VoiceNoteDigestInput {
  const sentences = note.sentences.filter((sentence) => sentence.text.trim() !== '');
  const groupSize = Math.max(
    1,
    Math.ceil(sentences.length / ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS),
  );

  return {
    text: sentences.map((sentence) => sentence.text.trim()).join(' '),
    durationSeconds: Math.round(note.durationMs / 1_000),
    segments: chunk(sentences, groupSize).map((group) => ({
      startMs: group[0]?.startMs ?? 0,
      text: group.map((sentence) => sentence.text.trim()).join(' '),
      isBookmarked: group.some((sentence) => sentence.isBookmarked),
    })),
  };
}

/** 정리한 내용을 메모 한 장으로 만든다. 제목이 비면 서버가 제목 없는 메모로 저장한다 */
export function createDigestMemo(note: VoiceNote): PlannedMemo | null {
  if (note.digest == null) {
    return null;
  }
  const { title, summary, keyPoints } = note.digest;
  const content = [summary, ...keyPoints.map((keyPoint) => `- ${keyPoint.text}`)]
    .filter((line) => line.trim() !== '')
    .join('\n')
    .slice(0, MEMO_LIMITS.MAX_CONTENT_LENGTH);

  return content === ''
    ? null
    : { type: 'create-memo', actionId: 'voice-note-memo', title, content };
}

/** 정리했는데 저장할 할 일이 없다. 요약은 남았고 횟수는 썼다. 카드를 읽지 못한 경우(`planDraft`가 null)와 구분한다 */
export function hasNoPlannedTodos(note: VoiceNote): boolean {
  return (
    note.digest != null &&
    note.appliedAt == null &&
    note.planDraft != null &&
    !note.planDraft.form.actions.some(isTodoAction)
  );
}

/** 정리한 제목. 정리 전이거나 서버가 비워 줬으면 null이라 화면이 기본 제목을 쓴다 */
export function getDigestTitle(note: VoiceNote): string | null {
  return note.digest == null || note.digest.title === '' ? null : note.digest.title;
}

/** 다시 듣기만 없앤 노트. 글자·요약·할 일은 그대로다 */
export function withoutRecordings(note: VoiceNote): VoiceNote {
  return { ...note, recordings: [] };
}

/** 이 노트의 녹음이 차지하는 크기. `sizes`는 파일 이름별 크기다 */
export function getRecordingSizeBytes(
  note: VoiceNote,
  sizes: Readonly<Record<string, number>>,
): number {
  return note.recordings.reduce((total, { fileName }) => total + (sizes[fileName] ?? 0), 0);
}

export function hasText(note: VoiceNote): boolean {
  return note.sentences.some((sentence) => sentence.text.trim() !== '');
}

/** 정리할 글자가 있고 아직 정리하지 않았다. 실패해서 다시 누르는 경우도 digest가 비어 있어 허용한다 */
export function canDigest(note: VoiceNote): boolean {
  return note.digest == null && hasText(note);
}

/** 다시 듣기 파일이 남아 있고 길이를 아는 노트. 파일이 실제로 있는지는 저장소가 확인한다 */
export function canPlayRecording(note: VoiceNote): boolean {
  return note.recordings.length > 0 && note.durationMs > 0;
}

/** 재생 위치에서 말하고 있는 핵심 포인트. 첫 포인트 전이면 없다 */
export function findKeyPointAt(note: VoiceNote, positionMs: number): VoiceNoteKeyPoint | undefined {
  if (note.digest == null) {
    return undefined;
  }

  return note.digest.keyPoints
    .filter((keyPoint) => keyPoint.startMs != null && keyPoint.startMs <= positionMs)
    .reduce<VoiceNoteKeyPoint | undefined>(
      (latest, keyPoint) =>
        latest == null || (keyPoint.startMs ?? 0) >= (latest.startMs ?? 0) ? keyPoint : latest,
      undefined,
    );
}

/** 위치가 속한 녹음 조각. 첫 조각 앞이면 첫 조각이다 */
export function findRecordingIndexAt(
  recordings: readonly { startMs: number }[],
  positionMs: number,
): number {
  return Math.max(
    0,
    recordings.findLastIndex((recording) => recording.startMs <= positionMs),
  );
}

const RETENTION_MS = VOICE_NOTE_RETENTION_DAYS * DAY_MS;

export function isExpired(note: VoiceNote, now: Date): boolean {
  return now.getTime() - note.createdAt.getTime() >= RETENTION_MS;
}

const ORPHAN_RETENTION_MS = VOICE_RECORDING_ORPHAN_RETENTION_DAYS * DAY_MS;

/**
 * 어느 초안도 가리키지 않는 녹음 파일의 보관 기한. 지운 초안의 뒤늦은 파일이라 오래 둘 이유가 없다.
 * 수정 시각을 모르면 기한이 지난 것으로 본다
 */
export function isRecordingFileExpired(modifiedAt: Date | null, now: Date): boolean {
  return modifiedAt == null || now.getTime() - modifiedAt.getTime() >= ORPHAN_RETENTION_MS;
}

export const VoiceNotePolicy = {
  hasText,
  hasNoPlannedTodos,
  canDigest,
  canPlayRecording,
  findKeyPointAt,
  findRecordingIndexAt,
  getDigestTitle,
  getRecordingSizeBytes,
  isExpired,
  isRecordingFileExpired,
} as const;

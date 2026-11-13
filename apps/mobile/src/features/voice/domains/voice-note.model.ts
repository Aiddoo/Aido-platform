import { ACTION_PLAN_LIMITS, MEMO_LIMITS } from '@aido/api/vocabulary';
import { SPEECH_LOCALES, type SpeechLocale } from '@src/core/ports/speech-recognizer';
import { DAY_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { type Instant, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { chunk, maxBy, orderBy, sumBy } from 'es-toolkit';
import { z } from 'zod';

import type { VoiceCaptureSeed } from './voice-capture.model';
import {
  type PlannedMemo,
  type PlanReviewDraft,
  planReviewDraftSchema,
  type VoiceNoteDigestResult,
  VoicePlanPolicy,
} from './voice-plan.model';
import { createVoiceTranscript } from './voice-transcript.model';

const VOICE_NOTE_RETENTION_DAYS = 30;

export const speechLocaleSchema = z.enum(SPEECH_LOCALES);

export const voiceNoteDraftIdSchema = z.string().min(1).brand<'VoiceNoteDraftId'>();

// 구간은 녹음 시작부터라 다시 듣기와 같은 시계를 쓴다
export const voiceNoteSentenceSchema = z.object({
  text: z.string(),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
  isBookmarked: z.boolean(),
  // 신뢰도를 주지 않는 기기는 비어 있다
  lowConfidenceWords: z.array(z.string()),
});
export type VoiceNoteSentence = z.infer<typeof voiceNoteSentenceSchema>;

export const voiceNoteKeyPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  // 말한 시각을 찾지 못하면 null이라 그 지점으로 갈 수 없다
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

// 멈췄다 이어 들으면 인식기가 파일을 새로 써서 조각마다 노트 시계의 시작을 든다
const voiceNoteRecordingSchema = z.object({
  fileName: z.string().min(1),
  startMs: z.int().nonnegative(),
});
export type VoiceNoteRecording = z.infer<typeof voiceNoteRecordingSchema>;

// 앱을 다시 켜도 같은 멱등 키를 써 차감이 겹치지 않는다
const voiceNoteDigestRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
});
export type VoiceNoteDigestRequest = z.infer<typeof voiceNoteDigestRequestSchema>;

// 카드를 고쳐서 보내면 새 키를 쓰도록 내용 지문을 함께 든다
const voiceNotePlanApplyRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
  fingerprint: z.string(),
});
export type VoiceNotePlanApplyRequest = z.infer<typeof voiceNotePlanApplyRequestSchema>;

const voiceNoteMemoSaveRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
});
export type VoiceNoteMemoSaveRequest = z.infer<typeof voiceNoteMemoSaveRequestSchema>;

// 녹음 파일은 폴더를 바꿔도 찾도록 파일 이름만 가진다
export const voiceNoteSchema = z.object({
  draftId: voiceNoteDraftIdSchema,
  locale: speechLocaleSchema,
  createdAt: instantSchema,
  durationMs: z.int().nonnegative(),
  sentences: z.array(voiceNoteSentenceSchema),
  recordings: z.array(voiceNoteRecordingSchema),
  digest: voiceNoteDigestSchema.nullable(),
  digestRequest: voiceNoteDigestRequestSchema.nullable(),
  planDraft: planReviewDraftSchema.nullable(),
  planApplyRequest: voiceNotePlanApplyRequestSchema.nullable(),
  appliedAt: instantSchema.nullable(),
  // 이 칸이 생기기 전에 저장한 초안은 null이다
  appliedTodoCount: z.int().nonnegative().nullable(),
  memoSaveRequest: voiceNoteMemoSaveRequestSchema.nullable(),
  memoSavedAt: instantSchema.nullable(),
});
export type VoiceNote = z.infer<typeof voiceNoteSchema>;

interface CreateVoiceNoteInput {
  draftId: string;
  locale: SpeechLocale;
  createdAt: Instant;
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
    planApplyRequest: null,
    appliedAt: null,
    appliedTodoCount: null,
    memoSaveRequest: null,
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

export function withDigestResult(
  note: VoiceNote,
  result: VoiceNoteDigestResult,
  planDraft: PlanReviewDraft,
): VoiceNote {
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
    planDraft,
  };
}

export function withPlanApplyRequest(
  note: VoiceNote,
  planApplyRequest: VoiceNotePlanApplyRequest | null,
): VoiceNote {
  return { ...note, planApplyRequest };
}

export function withAppliedAt(
  note: VoiceNote,
  appliedAt: Instant,
  appliedTodoCount: number,
): VoiceNote {
  return { ...note, appliedAt, appliedTodoCount, planDraft: null, planApplyRequest: null };
}

export function hasAppliedOnlyMemo(note: VoiceNote): boolean {
  return note.appliedAt != null && note.appliedTodoCount === 0;
}

export function withMemoSaveRequest(
  note: VoiceNote,
  memoSaveRequest: VoiceNoteMemoSaveRequest | null,
): VoiceNote {
  return { ...note, memoSaveRequest };
}

export function withMemoSavedAt(note: VoiceNote, memoSavedAt: Instant): VoiceNote {
  return { ...note, memoSavedAt, memoSaveRequest: null };
}

export interface VoiceNoteDigestInput {
  text: string;
  durationSeconds: number;
  segments: { startMs: number; text: string; isBookmarked: boolean }[];
}

export function createDigestInput(note: VoiceNote): VoiceNoteDigestInput {
  const sentences = note.sentences.filter((sentence) => sentence.text.trim() !== '');
  const groupSize = Math.max(
    1,
    Math.ceil(sentences.length / ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS),
  );

  return {
    text: sentences.map((sentence) => sentence.text.trim()).join(' '),
    durationSeconds: Math.round(note.durationMs / SECOND_MS),
    segments: chunk(sentences, groupSize).map((group) => ({
      startMs: group[0]?.startMs ?? 0,
      text: group.map((sentence) => sentence.text.trim()).join(' '),
      isBookmarked: group.some((sentence) => sentence.isBookmarked),
    })),
  };
}

// 정리한 내용을 메모 한 장으로 만든다. 제목이 비면 서버가 제목 없는 메모로 저장한다
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

// 정리했는데 저장할 할 일이 없다. 요약은 남았고 횟수는 썼다. 카드를 읽지 못한 경우(`planDraft`가 null)와 구분한다
export function hasEmptyPlan(note: VoiceNote): boolean {
  return (
    note.digest != null &&
    note.appliedAt == null &&
    note.planDraft != null &&
    !note.planDraft.form.actions.some(VoicePlanPolicy.isTodoAction)
  );
}

type VoiceNotePlanStatus =
  | { status: 'applied' }
  | { status: 'no-todos' }
  | { status: 'lost' }
  | { status: 'reviewable'; planDraft: PlanReviewDraft };

export function getPlanStatus(note: VoiceNote): VoiceNotePlanStatus {
  if (note.appliedAt != null) {
    return { status: 'applied' };
  }
  if (hasEmptyPlan(note) && (note.planDraft?.form.actions.length ?? 0) === 0) {
    return { status: 'no-todos' };
  }
  return note.planDraft == null
    ? { status: 'lost' }
    : { status: 'reviewable', planDraft: note.planDraft };
}

/** 추가하기 전에는 카드 중 할 일 수, 추가한 뒤에는 추가한 수다. 수를 남기기 전에 추가한 노트는 알 수 없어 null이다 */
export function findTodoCount(note: VoiceNote): number | null {
  if (note.appliedAt != null) {
    return note.appliedTodoCount;
  }
  return note.planDraft?.form.actions.filter(VoicePlanPolicy.isTodoAction).length ?? 0;
}

export function getCharacterCount(note: VoiceNote): number {
  return sumBy(note.sentences, ({ text }) => text.length);
}

export function getMarkCount(note: VoiceNote): number {
  return note.sentences.filter(({ isBookmarked }) => isBookmarked).length;
}

// findLastIndex처럼 첫 문장 앞이면 -1이다
export function getSentenceIndexAt(note: VoiceNote, positionMs: number): number {
  return note.sentences.findLastIndex(({ startMs }) => startMs <= positionMs);
}

export function findDigestTitle(note: VoiceNote): string | null {
  return note.digest == null || note.digest.title === '' ? null : note.digest.title;
}

export function withoutRecordings(note: VoiceNote): VoiceNote {
  return { ...note, recordings: [] };
}

export function getRecordingSizeBytes(
  note: VoiceNote,
  sizes: Readonly<Record<string, number>>,
): number {
  return sumBy(note.recordings, ({ fileName }) => sizes[fileName] ?? 0);
}

// 요약을 받은 노트는 결과 화면, 아직이면 정리 화면이다
export function isDigested(note: VoiceNote): boolean {
  return note.digest != null;
}

export function hasText(note: VoiceNote): boolean {
  return note.sentences.some((sentence) => sentence.text.trim() !== '');
}

// 글자가 있는 노트만 최근에 만든 것부터 보인다
export function getListedNotes(notes: readonly VoiceNote[]): VoiceNote[] {
  return orderBy(notes.filter(hasText), [(note) => toEpochMs(note.createdAt)], ['desc']);
}

export function canDigest(note: VoiceNote): boolean {
  return note.digest == null && hasText(note);
}

// 다시 듣기 파일이 남아 있고 길이를 아는 노트. 파일이 실제로 있는지는 저장소가 확인한다
export function canPlayRecording(note: VoiceNote): boolean {
  return note.recordings.length > 0 && note.durationMs > 0;
}

export function findKeyPointAt(note: VoiceNote, positionMs: number): VoiceNoteKeyPoint | null {
  if (note.digest == null) {
    return null;
  }

  const passed = note.digest.keyPoints.filter(
    (keyPoint) => keyPoint.startMs != null && keyPoint.startMs <= positionMs,
  );

  return maxBy(passed.toReversed(), (keyPoint) => keyPoint.startMs ?? 0) ?? null;
}

// 이어 말하기의 시작 상태. 저장된 문장을 확정된 글자로, 저장된 길이를 이미 들은 시간으로 잇는다
export function toCaptureSeed(note: VoiceNote): VoiceCaptureSeed {
  return {
    transcript: createVoiceTranscript({
      sentences: note.sentences.map(({ text }) => text),
    }),
    elapsedMs: note.durationMs,
  };
}

// 재생 조각 목록도 같은 규칙으로 찾아 시작 위치만 받는다
export function findRecordingIndexAt(
  recordings: readonly Pick<VoiceNoteRecording, 'startMs'>[],
  positionMs: number,
): number {
  return Math.max(
    0,
    recordings.findLastIndex((recording) => recording.startMs <= positionMs),
  );
}

const RETENTION_MS = VOICE_NOTE_RETENTION_DAYS * DAY_MS;

export function isExpired(note: VoiceNote, now: Instant): boolean {
  return toEpochMs(now) - toEpochMs(note.createdAt) >= RETENTION_MS;
}

export const VoiceNotePolicy = {
  withSentences,
  withRecordings,
  withDigestRequest,
  withDigestResult,
  withPlanDraft,
  withPlanApplyRequest,
  withAppliedAt,
  withMemoSaveRequest,
  withMemoSavedAt,
  withoutRecordings,
  hasText,
  getListedNotes,
  hasEmptyPlan,
  hasAppliedOnlyMemo,
  canDigest,
  canPlayRecording,
  findKeyPointAt,
  toCaptureSeed,
  getSentenceIndexAt,
  getPlanStatus,
  findTodoCount,
  getCharacterCount,
  getMarkCount,
  findDigestTitle,
  isDigested,
  getRecordingSizeBytes,
  isExpired,
} as const;

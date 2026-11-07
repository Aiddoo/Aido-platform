import { ACTION_PLAN_LIMITS, MEMO_LIMITS } from '@aido/api/vocabulary';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { DAY_MS } from '@src/shared/constants/time-units';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { chunk, maxBy, orderBy, sumBy } from 'es-toolkit';

import {
  VOICE_NOTE_RETENTION_DAYS,
  VOICE_RECORDING_ORPHAN_RETENTION_MS,
} from '../constants/voice-note.constants';
import type { PlanReviewDraft } from '../schemas/plan-review-form.schema';
import {
  type VoiceNote,
  type VoiceNoteDigestRequest,
  type VoiceNoteKeyPoint,
  type VoiceNoteMemoSaveRequest,
  type VoiceNotePlanApplyRequest,
  type VoiceNoteRecording,
  type VoiceNoteSentence,
  voiceNoteDraftIdSchema,
} from '../schemas/voice-note.schema';
import type { PlannedMemo, VoiceNoteDigestResult } from '../schemas/voice-plan.schema';
import type { VoiceCaptureSeed } from './voice-capture.model';
import { isTodoAction } from './voice-plan.model';
import { createVoiceTranscript } from './voice-transcript.model';

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

function withRecordings(note: VoiceNote, recordings: readonly VoiceNoteRecording[]): VoiceNote {
  return { ...note, recordings: [...recordings] };
}

function withDigestRequest(
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

function withPlanApplyRequest(
  note: VoiceNote,
  planApplyRequest: VoiceNotePlanApplyRequest | null,
): VoiceNote {
  return { ...note, planApplyRequest };
}

function withAppliedAt(note: VoiceNote, appliedAt: Instant, appliedTodoCount: number): VoiceNote {
  return { ...note, appliedAt, appliedTodoCount, planDraft: null, planApplyRequest: null };
}

function hasAppliedOnlyMemo(note: VoiceNote): boolean {
  return note.appliedAt != null && note.appliedTodoCount === 0;
}

function withMemoSaveRequest(
  note: VoiceNote,
  memoSaveRequest: VoiceNoteMemoSaveRequest | null,
): VoiceNote {
  return { ...note, memoSaveRequest };
}

function withMemoSavedAt(note: VoiceNote, memoSavedAt: Instant): VoiceNote {
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

type VoiceNotePlanStatus =
  | { status: 'applied' }
  | { status: 'no-todos' }
  | { status: 'lost' }
  | { status: 'reviewable'; planDraft: PlanReviewDraft };

function getPlanStatus(note: VoiceNote): VoiceNotePlanStatus {
  if (note.appliedAt != null) {
    return { status: 'applied' };
  }
  if (hasNoPlannedTodos(note) && (note.planDraft?.form.actions.length ?? 0) === 0) {
    return { status: 'no-todos' };
  }
  return note.planDraft == null
    ? { status: 'lost' }
    : { status: 'reviewable', planDraft: note.planDraft };
}

function getPlannedTodoCount(note: VoiceNote): number {
  return note.planDraft?.form.actions.filter(isTodoAction).length ?? 0;
}

function getCharacterCount(note: VoiceNote): number {
  return sumBy(note.sentences, ({ text }) => text.length);
}

function getMarkCount(note: VoiceNote): number {
  return note.sentences.filter(({ isBookmarked }) => isBookmarked).length;
}

function findSentenceIndexAt(note: VoiceNote, positionMs: number): number {
  return note.sentences.findLastIndex(({ startMs }) => startMs <= positionMs);
}

function getDigestTitle(note: VoiceNote): string | null {
  return note.digest == null || note.digest.title === '' ? null : note.digest.title;
}

function withoutRecordings(note: VoiceNote): VoiceNote {
  return { ...note, recordings: [] };
}

function getRecordingSizeBytes(note: VoiceNote, sizes: Readonly<Record<string, number>>): number {
  return sumBy(note.recordings, ({ fileName }) => sizes[fileName] ?? 0);
}

function hasText(note: VoiceNote): boolean {
  return note.sentences.some((sentence) => sentence.text.trim() !== '');
}

/** 글자가 있는 노트만 최근에 만든 것부터 보인다 */
function getListedNotes(notes: readonly VoiceNote[]): VoiceNote[] {
  return orderBy(notes.filter(hasText), [(note) => toEpochMs(note.createdAt)], ['desc']);
}

function canDigest(note: VoiceNote): boolean {
  return note.digest == null && hasText(note);
}

/** 다시 듣기 파일이 남아 있고 길이를 아는 노트. 파일이 실제로 있는지는 저장소가 확인한다 */
function canPlayRecording(note: VoiceNote): boolean {
  return note.recordings.length > 0 && note.durationMs > 0;
}

function findKeyPointAt(note: VoiceNote, positionMs: number): VoiceNoteKeyPoint | undefined {
  if (note.digest == null) {
    return undefined;
  }

  const passed = note.digest.keyPoints.filter(
    (keyPoint) => keyPoint.startMs != null && keyPoint.startMs <= positionMs,
  );

  return maxBy(passed.toReversed(), (keyPoint) => keyPoint.startMs ?? 0);
}

/** 이어 말하기의 시작 상태. 저장된 문장을 확정된 글자로, 저장된 길이를 이미 들은 시간으로 잇는다 */
function toCaptureSeed(note: Pick<VoiceNote, 'sentences' | 'durationMs'>): VoiceCaptureSeed {
  return {
    transcript: createVoiceTranscript({ sentences: note.sentences.map(({ text }) => text) }),
    elapsedMs: note.durationMs,
  };
}

function findRecordingIndexAt(
  recordings: readonly { startMs: number }[],
  positionMs: number,
): number {
  return Math.max(
    0,
    recordings.findLastIndex((recording) => recording.startMs <= positionMs),
  );
}

const RETENTION_MS = VOICE_NOTE_RETENTION_DAYS * DAY_MS;

function isExpired(note: VoiceNote, now: Instant): boolean {
  return toEpochMs(now) - toEpochMs(note.createdAt) >= RETENTION_MS;
}

/** 어느 초안도 가리키지 않는 녹음 파일의 보관 기한. 수정 시각을 모르면 기한이 지난 것으로 본다 */
function isRecordingFileExpired(modifiedAt: Date | null, now: Instant): boolean {
  return (
    modifiedAt == null ||
    toEpochMs(now) - modifiedAt.getTime() >= VOICE_RECORDING_ORPHAN_RETENTION_MS
  );
}

export const VoiceNotePolicy = {
  createVoiceNote,
  createDigestInput,
  createDigestMemo,
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
  hasNoPlannedTodos,
  hasAppliedOnlyMemo,
  canDigest,
  canPlayRecording,
  findKeyPointAt,
  toCaptureSeed,
  findRecordingIndexAt,
  findSentenceIndexAt,
  getPlanStatus,
  getPlannedTodoCount,
  getCharacterCount,
  getMarkCount,
  getDigestTitle,
  getRecordingSizeBytes,
  isExpired,
  isRecordingFileExpired,
} as const;

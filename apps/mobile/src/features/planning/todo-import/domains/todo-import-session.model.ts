import { TODO_IMPORT_TIME_MODES, TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import { z } from 'zod';

/** 확정 전 서버로 보낸 고른 값. 일정 제목은 담지 않는다(새 카테고리 이름은 캘린더 이름이다) */
export const todoImportSelectionSchema = z.object({
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  timeMode: z.enum(TODO_IMPORT_TIME_MODES),
  visibility: z.enum(TODO_VISIBILITIES),
  targets: z.array(
    z.discriminatedUnion('kind', [
      z.object({
        targetKey: z.string(),
        kind: z.literal('NEW_CATEGORY'),
        name: z.string(),
        color: z.string(),
      }),
      z.object({
        targetKey: z.string(),
        kind: z.literal('EXISTING_CATEGORY'),
        categoryId: z.int(),
      }),
    ]),
  ),
  collections: z.array(
    z.object({
      collectionKey: z.string(),
      targetKey: z.string(),
      expectedItemCount: z.int().nonnegative(),
    }),
  ),
});
export type TodoImportSelection = z.infer<typeof todoImportSelectionSchema>;

/**
 * 앱이 꺼지거나 연결이 끊겨도 이어 보내려고 계정 저장소에 남기는 업로드 상태.
 * 일정 제목은 남기지 않고, 이어 보낼 때 캘린더를 다시 읽어 지문이 같으면 끊긴 묶음부터 보낸다
 */
export const todoImportSessionSchema = z.object({
  /** POST 전에 저장해 앱이 죽어도 같은 키로 다시 보낸다(서버가 같은 가져오기를 돌려준다) */
  idempotencyKey: z.string(),
  /** 서버가 시작을 받기 전이면 null */
  importId: z.string().nullable(),
  selection: todoImportSelectionSchema,
  /** 마지막으로 읽은 일정의 지문. 아직 읽지 않았으면 null */
  fingerprint: z.string().nullable(),
  nextChunkIndex: z.int().nonnegative(),
  chunkCount: z.int().nonnegative().nullable(),
  /** 자정 경계로 기간을 한 번 다시 맞췄다. 두 번은 맞추지 않는다 */
  hasAdjustedRange: z.boolean(),
});
export type TodoImportSession = z.infer<typeof todoImportSessionSchema>;

export function createTodoImportSession({
  idempotencyKey,
  selection,
  hasAdjustedRange,
}: {
  idempotencyKey: string;
  selection: TodoImportSelection;
  hasAdjustedRange: boolean;
}): TodoImportSession {
  return {
    idempotencyKey,
    importId: null,
    selection,
    fingerprint: null,
    nextChunkIndex: 0,
    chunkCount: null,
    hasAdjustedRange,
  };
}

/** 기기 오늘이 서버 오늘보다 늦어 거절되면 오늘부터 같은 마지막 날까지로 맞춘다. 오늘이 그대로면 맞출 수 없다(null) */
export function adjustSelectionToToday(
  selection: TodoImportSelection,
  todayKey: DateKey,
): TodoImportSelection | null {
  if (todayKey <= selection.startDate) {
    return null;
  }
  return {
    ...selection,
    startDate: todayKey,
    endDate: selection.endDate < todayKey ? todayKey : selection.endDate,
  };
}

const RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60_000;
const EXPONENT_BASE = 2;

/**
 * 재시도 전 기다릴 시간(full jitter). 시도마다 상한이 두 배로 늘고 60초를 넘지 않는다.
 * 서버가 `Retry-After`로 알려 준 시간보다는 짧지 않다. 난수는 인자로 받아 테스트가 정한다
 */
export function getRetryDelayMs({
  attempt,
  retryAfterMs,
  random,
}: {
  attempt: number;
  retryAfterMs: number | null;
  random: () => number;
}): number {
  const ceilingMs = Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * EXPONENT_BASE ** attempt);
  return Math.max(Math.floor(random() * ceilingMs), retryAfterMs ?? 0);
}

/** 다시 읽은 일정이 지난번과 같으면 끊긴 묶음부터, 달라졌으면 처음부터 보낸다. 서버가 받은 키는 무시해 안전하다 */
function getNextChunkIndex(session: TodoImportSession, fingerprint: string) {
  return session.fingerprint === fingerprint ? session.nextChunkIndex : 0;
}

function hasFingerprintChanged(session: TodoImportSession, fingerprint: string) {
  return session.fingerprint != null && session.fingerprint !== fingerprint;
}

function withImportId(session: TodoImportSession, importId: string): TodoImportSession {
  return { ...session, importId };
}

function withChunks(
  session: TodoImportSession,
  { fingerprint, chunkCount }: { fingerprint: string; chunkCount: number },
): TodoImportSession {
  return {
    ...session,
    fingerprint,
    chunkCount,
    nextChunkIndex: getNextChunkIndex(session, fingerprint),
  };
}

function withUploadedChunk(session: TodoImportSession, chunkIndex: number): TodoImportSession {
  return { ...session, nextChunkIndex: chunkIndex + 1 };
}

export const TodoImportSessionPolicy = {
  getNextChunkIndex,
  hasFingerprintChanged,
  withImportId,
  withChunks,
  withUploadedChunk,
} as const;

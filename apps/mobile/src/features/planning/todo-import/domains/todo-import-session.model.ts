import { z } from 'zod';

import { type TodoImportSelection, todoImportSelectionSchema } from './todo-import-selection.model';

// 일정 제목은 남기지 않고, 이어 보낼 때 캘린더를 다시 읽어 지문이 같으면 끊긴 묶음부터 보낸다
export const todoImportSessionSchema = z.object({
  // POST 전에 저장해 앱이 죽어도 같은 키로 다시 보낸다(서버가 같은 가져오기를 돌려준다)
  idempotencyKey: z.string(),
  // 서버가 시작을 받기 전이면 null
  importId: z.string().nullable(),
  selection: todoImportSelectionSchema,
  // 아직 읽지 않았으면 null
  fingerprint: z.string().nullable(),
  nextChunkIndex: z.int().nonnegative(),
  chunkCount: z.int().nonnegative().nullable(),
  // 자정 경계로 기간을 한 번 다시 맞췄다. 두 번은 맞추지 않는다
  hasAdjustedRange: z.boolean(),
});
export type TodoImportSession = z.infer<typeof todoImportSessionSchema>;

interface TodoImportSessionSeed {
  idempotencyKey: string;
  selection: TodoImportSelection;
  hasAdjustedRange: boolean;
}

export function createTodoImportSession({
  idempotencyKey,
  selection,
  hasAdjustedRange,
}: TodoImportSessionSeed): TodoImportSession {
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

export const TodoImportSessionPolicy = {
  // 다시 읽은 일정이 지난번과 같으면 끊긴 묶음부터, 달라졌으면 처음부터 보낸다. 서버가 받은 키는 무시해 안전하다
  getNextChunkIndex(session: TodoImportSession, fingerprint: string): number {
    return session.fingerprint === fingerprint ? session.nextChunkIndex : 0;
  },

  hasFingerprintChanged(session: TodoImportSession, fingerprint: string): boolean {
    return session.fingerprint != null && session.fingerprint !== fingerprint;
  },

  withImportId(session: TodoImportSession, importId: string): TodoImportSession {
    return { ...session, importId };
  },

  withChunks(
    session: TodoImportSession,
    { fingerprint, chunkCount }: { fingerprint: string; chunkCount: number },
  ): TodoImportSession {
    return {
      ...session,
      fingerprint,
      chunkCount,
      nextChunkIndex: this.getNextChunkIndex(session, fingerprint),
    };
  },

  withUploadedChunk(session: TodoImportSession, chunkIndex: number): TodoImportSession {
    return { ...session, nextChunkIndex: chunkIndex + 1 };
  },
};

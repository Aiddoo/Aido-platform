import type { SyncStorage } from '@src/core/ports/sync-storage';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemoryObservableSyncStorage } from '@src/testing/core';

import { type CoachmarkInput, coachmarkKindSchema } from '../domains/coachmark.model';
import { coachmarkCompletedAtStoredValue } from '../schemas/coachmark-storage.schema';

/** 1.14.x부터 남긴 원문 모양(ISO 시각) */
const COACHMARK_COMPLETED_AT_RAW = '2026-10-01T00:00:00.000Z';

/** 운영과 같은 저장 값 정의로 안내를 끝냈는지 읽고, 끝낸 기록을 미리 남긴다 */
export function createCoachmarkRecords(syncStorage: SyncStorage) {
  return {
    hasSeen: (input: CoachmarkInput) =>
      readStoredValue(syncStorage, coachmarkCompletedAtStoredValue, input) != null,
    markSeen: (input: CoachmarkInput) =>
      writeStoredValue(
        syncStorage,
        coachmarkCompletedAtStoredValue,
        COACHMARK_COMPLETED_AT_RAW,
        input,
      ),
  };
}

/** `createTestDi({ syncStorage })`에 넘기면 운영처럼 같은 저장소를 읽어 `records.hasSeen`으로 끝냈는지 본다 */
export function createCoachmarkStorage(seen: readonly CoachmarkInput[] = []) {
  const syncStorage = createMemoryObservableSyncStorage();
  const records = createCoachmarkRecords(syncStorage);
  seen.forEach((input) => records.markSeen(input));

  return { syncStorage, records };
}

/** 안내 말풍선이 화면 동작을 가리지 않도록 모든 안내를 본 계정으로 채운다 */
export function createAllSeenCoachmarkStorage(accountId: string) {
  return createCoachmarkStorage(coachmarkKindSchema.options.map((kind) => ({ accountId, kind })));
}

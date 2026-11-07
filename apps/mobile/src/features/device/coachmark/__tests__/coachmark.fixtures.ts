import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';
import { getNowInstant } from '@src/shared/date/instant';

import { createCoachmarkRepository } from '../apis/coachmark.repository';
import { type CoachmarkInput, coachmarkKindSchema } from '../schemas/coachmark.schema';

/**
 * 안내를 이미 본 것으로 채운 저장소. `createTestDi({ syncStorage })`에 넘기면 운영처럼
 * 같은 저장소를 읽고, `repository.hasSeen`으로 화면이 안내를 끝냈는지 확인한다.
 */
export function createCoachmarkStorage(seen: readonly CoachmarkInput[] = []) {
  const syncStorage = createMemoryObservableSyncStorage();
  const repository = createCoachmarkRepository(syncStorage, getNowInstant);
  seen.forEach((input) => repository.markSeen(input));

  return { syncStorage, repository };
}

/** 안내 말풍선이 화면 동작을 가리지 않도록 모든 안내를 본 계정으로 채운다 */
export function createAllSeenCoachmarkStorage(accountId: string) {
  return createCoachmarkStorage(coachmarkKindSchema.options.map((kind) => ({ accountId, kind })));
}

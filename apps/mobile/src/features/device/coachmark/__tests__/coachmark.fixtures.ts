import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';
import { getNowInstant } from '@src/shared/date/instant';

import { createCoachmarkRepository } from '../apis/coachmark.repository';
import { type CoachmarkInput, coachmarkKindSchema } from '../domains/coachmark.model';

export function createCoachmarkStorage(seen: readonly CoachmarkInput[] = []) {
  const syncStorage = createMemoryObservableSyncStorage();
  const repository = createCoachmarkRepository(syncStorage, getNowInstant);
  seen.forEach((input) => repository.markSeen(input));

  return { syncStorage, repository };
}

export function createAllSeenCoachmarkStorage(accountId: string) {
  return createCoachmarkStorage(coachmarkKindSchema.options.map((kind) => ({ accountId, kind })));
}

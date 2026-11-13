import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import type { CoachmarkInput } from '../domains/coachmark.model';

/** 계정·종류가 뒤에 붙는다. repository가 계정 정리·은퇴 정리에 같은 앞부분을 쓴다 */
export const COACHMARK_KEY_PREFIX = 'aido_coachmark_v1';

/** 출시된 키처럼 계정 id를 인코딩하지 않는다 */
export function toCoachmarkKey({ accountId, kind }: CoachmarkInput): string {
  return `${COACHMARK_KEY_PREFIX}:${accountId}:${kind}`;
}

/** 안내를 끝낸 시각 원문. 1.14.x부터 ISO 시각을 썼지만 키가 있기만 하면 끝낸 것이다 */
export const coachmarkCompletedAtStoredValue = defineStoredValue({
  key: toCoachmarkKey,
  schema: z.string(),
  fallback: null,
});

import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';

import { pendingRedemptionSchema } from '../domains/invite-redemption.model';

/** 로그인 전에 연 초대를 로그인 뒤 이어서 열 수 있게 기기에 잠깐 남긴다. 계정 구분이 없어 로그아웃 때 지운다 */
export const pendingRedemptionStoredValue = defineStoredValue({
  key: 'aido_invite_pending_v1',
  schema: storedJsonSchema(pendingRedemptionSchema),
  fallback: null,
});

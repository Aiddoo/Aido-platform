import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';

import { activationProgressSchema } from '../domains/activation.model';

/** 계정의 시작 체크리스트 진행. 1.14.x가 남긴 `pushRegistrationUnlockedAt`은 모르는 칸이라 읽지 않고 버린다 */
export const activationProgressStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_activation_v2:${accountId}`,
  schema: storedJsonSchema(activationProgressSchema),
  fallback: { todoCreatedAt: null, activatedAt: null },
});

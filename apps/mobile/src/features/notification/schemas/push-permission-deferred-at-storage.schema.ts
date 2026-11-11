import { instantSchema } from '@src/shared/date/instant';
import { defineStoredValue } from '@src/shared/storage/define-stored-value';

/** 가입 직후 알림 화면을 닫은 시각 */
export const pushPermissionDeferredAtStoredValue = defineStoredValue({
  key: (userId: string) => `aido_push_permission_prompt_deferred_v1:${userId}`,
  schema: instantSchema,
  fallback: null,
});

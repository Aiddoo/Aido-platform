import { instantSchema } from '@src/shared/date/instant';
import { defineStoredValue } from '@src/shared/storage/define-stored-value';

/** 피드 알림 꺼짐 안내를 닫은 시각. 출시된 앱이 쓰던 키를 그대로 읽는다 */
export const pushNoticeDismissedAtStoredValue = defineStoredValue({
  key: (userId: string) => `aido_push_permission_prompt_dismissed_v1:${userId}`,
  schema: instantSchema,
  fallback: null,
});

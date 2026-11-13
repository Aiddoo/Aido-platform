import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** 앱 없이 깨어난 위젯 프로세스가 남긴 실패. 다음 앱 시작 때 오류 보고기로 보낸다 */
export const widgetHeadlessFailureStoredValue = defineStoredValue({
  key: 'aido_widget_headless_failure_v1',
  schema: storedJsonSchema(
    z.object({
      method: z.string(),
      name: z.string(),
      message: z.string(),
    }),
  ),
  fallback: null,
});

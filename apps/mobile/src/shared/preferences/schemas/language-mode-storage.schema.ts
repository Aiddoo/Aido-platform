import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import { LANGUAGE_MODES } from '../language.preference';

/** 앱 언어. 계정과 무관한 기기 설정이고 키는 출시된 앱이 남긴 그대로다 */
export const languageModeStoredValue = defineStoredValue({
  key: 'aido_language',
  schema: z.enum(LANGUAGE_MODES),
  fallback: 'system',
});

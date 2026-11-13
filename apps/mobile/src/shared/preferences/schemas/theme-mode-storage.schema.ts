import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import { THEME_MODES } from '../theme-mode.preference';

/** 화면 모드. 계정과 무관한 기기 설정이고 키는 출시된 앱이 남긴 그대로다 */
export const themeModeStoredValue = defineStoredValue({
  key: 'aido_theme_mode',
  schema: z.enum(THEME_MODES),
  fallback: 'system',
});

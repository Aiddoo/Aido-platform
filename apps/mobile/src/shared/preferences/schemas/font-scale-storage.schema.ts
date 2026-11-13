import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import { FONT_SCALES } from '../font-scale.preference';

/** 글꼴 크기. 계정과 무관한 기기 설정이고 키는 출시된 앱이 남긴 그대로다 */
export const fontScaleStoredValue = defineStoredValue({
  key: 'aido_font_scale',
  schema: z.enum(FONT_SCALES),
  fallback: 'medium',
});

import type { updatePreferenceSchema } from '@aido/api';
import type { z } from 'zod';

/** 바꿀 칸만 담는다. 서버가 한 칸 이상을 요구한다. 시간대는 기기가 따로 보고한다 */
export type PreferenceChange = Omit<z.input<typeof updatePreferenceSchema>, 'timezone'>;

import { type updatePreferenceSchema, userPreferenceSchema } from '@aido/api';
import type { z } from 'zod';

/** 기기 시간대는 기기가 정하므로 서버 값에서 앱이 쓰지 않는 칸을 뺀다 */
export const preferenceSchema = userPreferenceSchema.omit({ timezone: true });
export type Preference = z.infer<typeof preferenceSchema>;

/** 바꿀 칸만 담는다. 서버가 한 칸 이상을 요구한다. 시간대는 기기가 따로 보고한다 */
export type PreferenceChange = Omit<z.input<typeof updatePreferenceSchema>, 'timezone'>;

import { updatePreferenceSchema } from '@aido/api';
import type { z } from 'zod';

/** 바꿀 칸만 담는다. 서버가 한 칸 이상을 요구한다. 시간대는 기기가 따로 보고한다 */
export type PreferenceChange = Omit<z.input<typeof updatePreferenceSchema>, 'timezone'>;

/** 설정 변경 지표(settings_changed.setting)가 칸 이름을 그대로 보낸다 */
export const PREFERENCE_SETTINGS = updatePreferenceSchema.keyof().exclude(['timezone']).options;

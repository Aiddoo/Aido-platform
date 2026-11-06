import { profileIconKeySchema } from '@aido/api';
import type { z } from 'zod';

/** 앱 아이콘과 프로필 아이콘은 같은 고양이 목록을 쓴다 */
export const appIconKeySchema = profileIconKeySchema;
export type AppIconKey = z.infer<typeof appIconKeySchema>;

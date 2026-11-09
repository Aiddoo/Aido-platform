import { PROFILE_ICON_KEYS } from '@aido/api/vocabulary';
import { z } from 'zod';

export const appIconKeySchema = z.enum(PROFILE_ICON_KEYS);
export type AppIconKey = z.infer<typeof appIconKeySchema>;

/** 기본 아이콘만 누구나 쓸 수 있고 나머지는 구독 기능이다 */
function isPremiumIcon(key: AppIconKey) {
  return key !== 'default';
}

export const AppIconPolicy = { isPremiumIcon } as const;

import { PROFILE_ICON_KEYS } from '@aido/api/vocabulary';
import { z } from 'zod';

export const appIconKeySchema = z.enum(PROFILE_ICON_KEYS);
export type AppIconKey = z.infer<typeof appIconKeySchema>;

function isPremiumIcon(key: AppIconKey) {
  return key !== 'default';
}

export const AppIconPolicy = { isPremiumIcon } as const;

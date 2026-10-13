import { profileIconKeySchema } from '@aido/api';
import { z } from 'zod';

export const appIconKeySchema = profileIconKeySchema;
export type AppIconKey = z.infer<typeof appIconKeySchema>;
const nativeIconSchema = z.object({ nativeKey: z.string().nullable() });
type NativeIcon = z.infer<typeof nativeIconSchema>;
const selectedIconSchema = z.object({ key: appIconKeySchema });
type SelectedIcon = z.infer<typeof selectedIconSchema>;

export function resolveAppIconKey(icon: NativeIcon): AppIconKey {
  const result = appIconKeySchema.safeParse(icon.nativeKey);
  return result.success ? result.data : 'default';
}

export function getNativeAppIconName(icon: SelectedIcon): AppIconKey | null {
  return icon.key === 'default' ? null : icon.key;
}

export const AppIconPolicy = {
  resolveKey: resolveAppIconKey,
  nativeName: getNativeAppIconName,
} as const;

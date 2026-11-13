export const THEME_MODES = ['light', 'dark', 'system'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

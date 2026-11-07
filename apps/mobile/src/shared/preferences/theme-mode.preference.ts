export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_STORAGE_KEY = 'aido_theme_mode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function parseThemeMode(saved: string | undefined): ThemeMode {
  return isThemeMode(saved) ? saved : 'system';
}

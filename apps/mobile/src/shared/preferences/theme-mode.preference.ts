export type ThemeMode = 'light' | 'dark' | 'system';

// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
export const THEME_MODE_STORAGE_KEY = 'aido_theme_mode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function toThemeMode(saved: string | undefined): ThemeMode {
  return isThemeMode(saved) ? saved : 'system';
}

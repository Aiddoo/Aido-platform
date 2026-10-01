import type { SyncStorage } from '@src/core/ports/sync-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'aido_theme_mode';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemeMode(storage: SyncStorage): ThemeMode {
  const saved = storage.getString(KEY);

  if (isThemeMode(saved)) {
    return saved;
  }

  return 'system';
}

export function writeThemeMode(storage: SyncStorage, mode: ThemeMode): void {
  storage.set(KEY, mode);
}

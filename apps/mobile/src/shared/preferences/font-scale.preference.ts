import type { SyncStorage } from '@src/core/ports/sync-storage';

export type FontScale = 'small' | 'normal' | 'large';

const KEY = 'aido_font_scale';

export function readFontScale(storage: SyncStorage): FontScale {
  const saved = storage.getString(KEY);

  if (saved === 'small' || saved === 'normal' || saved === 'large') {
    return saved;
  }

  return 'normal';
}

export function writeFontScale(storage: SyncStorage, scale: FontScale): void {
  storage.set(KEY, scale);
}

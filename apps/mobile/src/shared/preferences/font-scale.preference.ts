import type { SyncStorage } from '@src/core/ports/sync-storage';

export const FONT_SCALES = ['xsmall', 'small', 'medium', 'large', 'xlarge'] as const;

export type FontScale = (typeof FONT_SCALES)[number];

const KEY = 'aido_font_scale';

export function isFontScale(value: unknown): value is FontScale {
  return typeof value === 'string' && FONT_SCALES.includes(value as FontScale);
}

export function readFontScale(storage: SyncStorage): FontScale {
  const saved = storage.getString(KEY);

  if (isFontScale(saved)) {
    return saved;
  }

  return 'medium';
}

export function writeFontScale(storage: SyncStorage, scale: FontScale): void {
  storage.set(KEY, scale);
}

const FONT_SCALES = ['xsmall', 'small', 'medium', 'large', 'xlarge'] as const;

export type FontScale = (typeof FONT_SCALES)[number];

// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
export const FONT_SCALE_STORAGE_KEY = 'aido_font_scale';

export function isFontScale(value: unknown): value is FontScale {
  return FONT_SCALES.some((candidate) => candidate === value);
}

export function toFontScale(saved: string | undefined): FontScale {
  return isFontScale(saved) ? saved : 'medium';
}

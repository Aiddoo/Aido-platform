export const FONT_SCALES = ['xsmall', 'small', 'medium', 'large', 'xlarge'] as const;

export type FontScale = (typeof FONT_SCALES)[number];

export function isFontScale(value: unknown): value is FontScale {
  return FONT_SCALES.some((candidate) => candidate === value);
}

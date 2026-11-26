export const FONT_SCALES = ['xsmall', 'small', 'medium', 'large', 'xlarge'] as const;

export type FontScale = (typeof FONT_SCALES)[number];

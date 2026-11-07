import { tv } from '@src/shared/utils/tv';

import type { TextShade, TextSize } from './text.types';

export const TEXT_SIZE_CLASSES = {
  display: 'text-display',
  h1: 'text-h1',
  t1: 'text-t1',
  t2: 'text-t2',
  t3: 'text-t3',
  b1: 'text-b1',
  b2: 'text-b2',
  b3: 'text-b3',
  b4: 'text-b4',
  e1: 'text-e1',
  e2: 'text-e2',
} satisfies Record<TextSize, string>;

/**
 * 글자 크기만 정하는 입력칸 유틸리티. 줄 간격을 건드리지 않아 보통 크기의 입력칸 모양이 그대로다.
 * `global.css`에서 `text-*`보다 뒤에 있어 함께 쓰면 글자 크기는 이쪽을 따른다.
 */
export const INPUT_FONT_SIZE_CLASSES = {
  display: 'text-input-display',
  h1: 'text-input-h1',
  t1: 'text-input-t1',
  t2: 'text-input-t2',
  t3: 'text-input-t3',
  b1: 'text-input-b1',
  b2: 'text-input-b2',
  b3: 'text-input-b3',
  b4: 'text-input-b4',
  e1: 'text-input-e1',
  e2: 'text-input-e2',
} satisfies Record<TextSize, string>;

export const textVariants = tv({
  base: 'font-normal',

  variants: {
    tone: {
      neutral: 'text-foreground',
      brand: 'text-main',
      danger: 'text-error',
      warning: 'text-warning',
      success: 'text-success',
      info: 'text-info',
      white: 'text-white',
      onSky: 'text-on-sky',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    size: TEXT_SIZE_CLASSES,
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
    strikethrough: {
      true: 'line-through',
      false: '',
    },
    underline: {
      true: 'underline',
      false: '',
    },
  },

  defaultVariants: {
    weight: 'normal',
    tone: 'neutral',
    size: 'b3',
    align: 'left',
    strikethrough: false,
    underline: false,
  },
});

export const TEXT_SHADE_CLASSES = {
  1: 'text-gray-1',
  2: 'text-gray-2',
  3: 'text-gray-3',
  4: 'text-gray-4',
  5: 'text-gray-5',
  6: 'text-gray-6',
  7: 'text-gray-7',
  8: 'text-gray-8',
  9: 'text-gray-9',
  10: 'text-gray-10',
} satisfies Record<TextShade, string>;

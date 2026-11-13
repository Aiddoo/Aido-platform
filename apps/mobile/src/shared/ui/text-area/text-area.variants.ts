import { tv } from '@src/shared/utils/tv';

import type { TextSize } from '../text/text.types';
import { INPUT_FONT_SIZE_CLASSES } from '../text/text.variants';
import type { TextAreaVariant } from './text-area.types';

export const TEXT_AREA_TEXT_SIZES = {
  filled: 'b2',
  line: 'b2',
  plain: 'b3',
  bare: 'b2',
} satisfies Record<TextAreaVariant, TextSize>;

export const textAreaLabelVariants = tv({
  base: 'text-gray-6',
  variants: {
    isFocused: {
      true: 'text-main',
    },
    isInvalid: {
      true: 'text-error',
    },
  },
});

export const textAreaContainerVariants = tv({
  base: '',
  variants: {
    variant: {
      filled: 'min-h-[120px] rounded-xl border border-gray-2 bg-gray-1 px-4 py-3',
      line: 'min-h-[120px] rounded-none border-b border-gray-3 bg-transparent px-4 py-3',
      plain: 'min-h-14 bg-transparent px-0 py-1',
      bare: 'flex-1 bg-transparent p-0',
    },
    isFocused: {
      true: '',
    },
    isDisabled: {
      true: 'opacity-40',
    },
    isInvalid: {
      true: '',
    },
  },
  compoundVariants: [
    { variant: 'filled', isFocused: true, className: 'border-main' },
    { variant: 'line', isFocused: true, className: 'border-main' },
    { variant: 'filled', isInvalid: true, className: 'bg-error-light' },
    { variant: 'line', isInvalid: true, className: 'border-error' },
  ],
  defaultVariants: {
    variant: 'filled',
  },
});

export const textAreaTextVariants = tv({
  base: 'flex-1 text-gray-8 placeholder:text-gray-5',
  variants: {
    variant: {
      filled: '',
      line: '',
      plain: 'text-b3',
      // 키보드에 바로 붙는 칸이다. 줄을 바꾼 새 줄이 칸 밖으로 나가 커서가 잠깐 잘리지 않게 한 줄 넘게 비워 둔다
      bare: 'pb-10',
    },
    fontSize: INPUT_FONT_SIZE_CLASSES,
  },
  defaultVariants: {
    variant: 'filled',
  },
});

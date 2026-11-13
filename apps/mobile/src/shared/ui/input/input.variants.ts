import { tv } from '@src/shared/utils/tv';

import type { TextSize } from '../text/text.types';
import { INPUT_FONT_SIZE_CLASSES } from '../text/text.variants';
import type { InputSize } from './input.types';

export const INPUT_TEXT_SIZES = { medium: 'b3', large: 'b2' } satisfies Record<InputSize, TextSize>;

export const inputLabelVariants = tv({
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

export const inputContainerVariants = tv({
  base: 'flex-row items-center',
  variants: {
    variant: {
      filled: 'rounded-xl border border-gray-2 bg-gray-1',
      line: 'rounded-none border-b border-gray-3 bg-transparent',
    },
    size: {
      medium: 'h-12 px-4',
      large: 'h-14 px-4',
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
    { variant: 'filled', isInvalid: true, className: 'bg-error/10' },
    { variant: 'line', isInvalid: true, className: 'border-error' },
  ],
  defaultVariants: {
    variant: 'filled',
    size: 'large',
  },
});

export const inputTextVariants = tv({
  base: 'flex-1 text-gray-8 placeholder:text-gray-5',
  variants: {
    fontSize: INPUT_FONT_SIZE_CLASSES,
    hasLeftContent: {
      false: 'pl-0',
    },
  },
  defaultVariants: {
    hasLeftContent: false,
  },
});

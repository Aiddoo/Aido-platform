import { tv } from '@src/shared/utils/tv';

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
      filled: 'min-h-[120px] bg-gray-1 rounded-xl border border-gray-2 px-4 py-3',
      line: 'min-h-[120px] bg-transparent border-b border-gray-3 rounded-none px-4 py-3',
      plain: 'min-h-14 bg-transparent px-0 py-1',
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
      filled: 'text-input-lg',
      line: 'text-input-lg',
      plain: 'text-b3',
    },
  },
  defaultVariants: {
    variant: 'filled',
  },
});

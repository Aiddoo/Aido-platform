import { tv } from 'tailwind-variants';

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
      filled: 'bg-gray-1 rounded-xl border border-transparent',
      line: 'bg-transparent border-b border-gray-3 rounded-none',
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

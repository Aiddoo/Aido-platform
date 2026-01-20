import { tv } from 'tailwind-variants';

export const textButtonVariants = tv({
  base: 'items-center justify-center flex-row',

  variants: {
    size: {
      xsmall: 'text-e2',
      small: 'text-e1',
      medium: 'text-b4',
      large: 'text-b3',
      xlarge: 'text-b2',
    },
    variant: {
      clear: '',
      underline: 'underline',
      arrow: '',
    },
    isDisabled: {
      true: 'opacity-40',
    },
  },

  defaultVariants: {
    size: 'medium',
    variant: 'clear',
  },
});

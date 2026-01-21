import { tv } from 'tailwind-variants';

export const listRowVariants = tv({
  base: '',

  variants: {
    verticalPadding: {
      small: 'py-1',
      medium: 'py-2',
      large: 'py-4',
      xlarge: 'py-5',
    },
    horizontalPadding: {
      none: '',
      small: 'px-2',
      medium: 'px-4',
    },
    border: {
      none: '',
      indented: 'border-b border-gray-100',
    },
    disabled: {
      true: 'opacity-40',
    },
  },

  defaultVariants: {
    verticalPadding: 'medium',
    horizontalPadding: 'none',
    border: 'none',
  },
});

export const listRowSlotVariants = tv({
  variants: {
    alignment: {
      top: 'items-start',
      center: 'items-center',
    },
  },

  defaultVariants: {
    alignment: 'center',
  },
});

export const listRowIconVariants = tv({
  base: 'items-center justify-center',

  variants: {
    size: {
      small: 'w-6 h-6',
      medium: 'w-10 h-10',
      large: 'w-12 h-12',
    },
  },

  defaultVariants: {
    size: 'small',
  },
});

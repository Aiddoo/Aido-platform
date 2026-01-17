import { tv } from 'tailwind-variants';

export const textVariants = tv(
  {
    base: 'font-normal',

    variants: {
      color: {
        foreground: 'text-foreground',
        muted: 'text-muted',
        accent: 'text-accent',
        danger: 'text-danger',
        main: 'text-main',
        secondary: 'text-secondary',
        error: 'text-error',
        'gray-1': 'text-gray-1',
        'gray-2': 'text-gray-2',
        'gray-3': 'text-gray-3',
        'gray-4': 'text-gray-4',
        'gray-5': 'text-gray-5',
        'gray-6': 'text-gray-6',
        'gray-7': 'text-gray-7',
        'gray-8': 'text-gray-8',
        'gray-9': 'text-gray-9',
        'gray-10': 'text-gray-10',
      },
      weight: {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
      },
      size: {
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
      },
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
      color: 'gray-8',
      size: 'b3',
      align: 'left',
      strikethrough: false,
      underline: false,
    },
  },
  {
    twMerge: false,
  },
);

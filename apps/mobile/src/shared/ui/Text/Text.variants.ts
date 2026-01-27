import { tv } from 'tailwind-variants';

export const textVariants = tv(
  {
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
      tone: 'neutral',
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

export const shadeClasses: Record<number, string> = {
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
};

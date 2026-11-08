import { tv } from '@src/shared/utils/tv';

export const highlightVariants = tv({
  variants: {
    radius: {
      sm: 'rounded-md',
      md: 'rounded-lg',
      lg: 'rounded-xl',
      full: 'rounded-full',
    },
  },
  defaultVariants: {
    radius: 'lg',
  },
});

export const buttonVariants = tv({
  base: 'gap-0 disabled:opacity-100',

  variants: {
    size: {
      small: 'h-8 px-3',
      medium: 'h-10 px-4',
      large: 'h-12 px-5',
      xlarge: 'h-14 px-6',
    },
    radius: {
      sm: 'rounded-md',
      md: 'rounded-lg',
      lg: 'rounded-xl',
      full: 'rounded-full',
    },
    display: {
      inline: '',
      block: 'self-stretch',
      full: 'w-full',
    },
    variant: {
      fill: '',
      weak: '',
    },
    color: {
      primary: '',
      danger: '',
      dark: '',
    },
    isDisabled: {
      true: '',
    },
  },

  compoundVariants: [
    { variant: 'fill', color: 'primary', className: 'bg-main' },
    { variant: 'fill', color: 'danger', className: 'bg-error' },
    { variant: 'fill', color: 'dark', className: 'bg-gray-9 dark:bg-gray-3' },
    { variant: 'weak', color: 'primary', className: 'bg-main/5 dark:bg-main/20' },
    { variant: 'weak', color: 'danger', className: 'bg-error/5 dark:bg-error/20' },
    { variant: 'weak', color: 'dark', className: 'bg-gray-9/5 dark:bg-gray-9/20' },
    { variant: 'fill', color: 'primary', isDisabled: true, className: 'bg-gray-5 dark:bg-gray-4' },
    { variant: 'fill', color: 'danger', isDisabled: true, className: 'bg-gray-5 dark:bg-gray-4' },
    { variant: 'fill', color: 'dark', isDisabled: true, className: 'bg-gray-7 dark:bg-gray-4' },
  ],

  defaultVariants: {
    size: 'xlarge',
    radius: 'lg',
    display: 'full',
    variant: 'fill',
    color: 'primary',
  },
});

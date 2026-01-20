import { tv } from 'tailwind-variants';

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
  base: 'items-center justify-center',

  variants: {
    size: {
      small: 'h-8 px-3 text-e1',
      medium: 'h-10 px-4 text-b4',
      large: 'h-12 px-5 text-b2',
      xlarge: 'h-14 px-6 text-b1',
    },
    radius: {
      sm: 'rounded-md',
      md: 'rounded-lg',
      lg: 'rounded-xl',
      full: 'rounded-full',
    },
    display: {
      inline: 'self-start',
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
      true: 'opacity-40',
    },
  },

  compoundVariants: [
    // fill variants
    { variant: 'fill', color: 'primary', className: 'bg-main' },
    { variant: 'fill', color: 'danger', className: 'bg-error' },
    { variant: 'fill', color: 'dark', className: 'bg-gray-9' },
    // weak variants
    { variant: 'weak', color: 'primary', className: 'bg-main/20' },
    { variant: 'weak', color: 'danger', className: 'bg-error/20' },
    { variant: 'weak', color: 'dark', className: 'bg-gray-9/20' },
  ],

  defaultVariants: {
    size: 'xlarge',
    radius: 'lg',
    display: 'full',
    variant: 'fill',
    color: 'primary',
  },
});

import { tv } from '@src/shared/utils/tv';

export const iconCircleVariants = tv({
  base: 'size-11 items-center justify-center rounded-full',
  variants: {
    tone: {
      brand: 'bg-main',
      outline: 'border-[1.5px] border-dashed border-main bg-main/10',
      neutral: 'border border-gray-3 bg-white dark:border-gray-2 dark:bg-gray-1',
      plain: '',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
});

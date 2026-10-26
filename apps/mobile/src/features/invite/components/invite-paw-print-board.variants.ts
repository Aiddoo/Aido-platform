import { tv } from '@src/shared/utils/tv';

export const pawPrintVariants = tv({
  base: 'size-14 items-center justify-center rounded-full',
  variants: {
    state: {
      stamped: '-rotate-6 bg-main',
      waiting: 'border-[1.5px] border-dashed border-main bg-main/10',
      empty: 'border border-gray-2 bg-gray-1',
      milestone: 'border border-fish bg-fish/10',
    },
    isNext: {
      true: '',
    },
  },
  compoundVariants: [
    { state: 'empty', isNext: true, className: 'border-[1.5px] border-main/50 bg-highlight' },
  ],
});

export const pawPrintIconVariants = tv({
  variants: {
    state: {
      stamped: 'text-white dark:text-gray-1',
      waiting: 'text-main opacity-40',
      empty: 'text-gray-3',
      milestone: 'text-fish',
    },
    isNext: {
      true: '',
    },
  },
  compoundVariants: [{ state: 'empty', isNext: true, className: 'text-main/50' }],
});

export const fishBoneVariants = tv({
  variants: {
    isFilled: {
      true: 'text-main',
      false: 'text-gray-3',
    },
  },
});

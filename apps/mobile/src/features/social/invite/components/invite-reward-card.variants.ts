import { tv } from '@src/shared/utils/tv';

export const inviteRewardDotVariants = tv({
  base: 'size-9 rounded-full',
  variants: {
    state: {
      stamped: 'bg-main',
      waiting: 'border-[1.5px] border-dashed border-main',
      empty: 'bg-gray-1',
      milestone: 'border border-fish bg-fish/10',
    },
  },
});

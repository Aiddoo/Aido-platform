import { tv } from '@src/shared/utils/tv';

export const invitedFriendChipVariants = tv({
  base: 'min-h-7 flex-row items-center gap-1 rounded-full',
  variants: {
    state: {
      stamped: 'bg-main/10 pl-1 pr-2.5',
      waiting: 'border-[1.5px] border-dashed border-main px-2',
    },
  },
});

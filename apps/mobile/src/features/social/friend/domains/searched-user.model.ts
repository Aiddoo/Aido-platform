import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { z } from 'zod';

export const searchedUserSchema = userSummarySchema.extend({
  isFriend: z.boolean(),
  requestPending: z.boolean(),
});
export type SearchedUser = z.infer<typeof searchedUserSchema>;

const searchedUserPageSchema = cursorPageSchema(searchedUserSchema, z.string());
export type SearchedUserPage = z.infer<typeof searchedUserPageSchema>;

type RequestState = 'friend' | 'pending' | 'none';

export const SearchedUserPolicy = {
  // 이미 친구면 요청 대기보다 먼저다
  getRequestState(user: SearchedUser): RequestState {
    if (user.isFriend) {
      return 'friend';
    }
    if (user.requestPending) {
      return 'pending';
    }

    return 'none';
  },
};

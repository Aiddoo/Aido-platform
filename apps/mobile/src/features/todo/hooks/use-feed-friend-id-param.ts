import { userIdParamSchema } from '@aido/api';
import { useRouteSearchParams } from '@src/shared/providers/route-search-params-provider';
import { z } from 'zod';

const feedFriendSearchSchema = z.object({
  friendId: userIdParamSchema.shape.userId.optional().catch(undefined),
});

/** 피드 URL에서 선택된 친구 id를 검증해 읽는다. */
export function useFeedFriendIdParam() {
  return feedFriendSearchSchema.parse(useRouteSearchParams()).friendId;
}

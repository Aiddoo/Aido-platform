import { userIdParamSchema } from '@aido/api';
import { z } from 'zod';

import { feedDateParamSchema } from './feed-date-param';

const feedActionParamSchema = z.literal('add-todo').optional().catch(undefined);

const feedFriendIdParamSchema = userIdParamSchema.shape.userId.optional().catch(undefined);

export const feedSearchParamsSchema = z.object({
  date: feedDateParamSchema,
  action: feedActionParamSchema,
  friendId: feedFriendIdParamSchema,
});

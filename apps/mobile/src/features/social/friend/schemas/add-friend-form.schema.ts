import { userTagParamSchema } from '@aido/api';
import type { z } from 'zod';

import { userTagSchema } from './friend.schema';

export const addFriendFormSchema = userTagParamSchema;
export type AddFriendFormValues = z.infer<typeof addFriendFormSchema>;

export const EMPTY_ADD_FRIEND_FORM_VALUES: AddFriendFormValues = { userTag: '' };

export const USER_TAG_MAX_LENGTH = userTagSchema.maxLength ?? undefined;

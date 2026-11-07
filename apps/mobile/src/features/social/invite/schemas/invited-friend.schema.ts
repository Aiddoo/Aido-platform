import { invitedFriendResponseSchema, invitedFriendsListResponseSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

// 모르는 새 상태·사유는 @aido/api 스키마가 UNKNOWN·null로 읽는다
export const invitedFriendSchema = invitedFriendResponseSchema.extend({
  joinedAt: instantSchema,
  qualifiedAt: instantSchema.nullable(),
});

export type InvitedFriend = z.output<typeof invitedFriendSchema>;

export const invitedFriendsPageSchema = invitedFriendsListResponseSchema.extend({
  items: z.array(invitedFriendSchema),
});

export type InvitedFriendsPage = z.output<typeof invitedFriendsPageSchema>;

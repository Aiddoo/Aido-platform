import { invitedFriendResponseSchema, invitedFriendsListResponseSchema } from '@aido/api';
import { z } from 'zod';

// 모르는 새 상태·사유는 @aido/api 스키마가 UNKNOWN·null로 읽는다
export const InvitedFriendSchema = invitedFriendResponseSchema.extend({
  joinedAt: z.coerce.date(),
  qualifiedAt: z.coerce.date().nullable(),
});

export type InvitedFriend = z.output<typeof InvitedFriendSchema>;

export const InvitedFriendsPageSchema = invitedFriendsListResponseSchema.extend({
  items: z.array(InvitedFriendSchema),
});

export type InvitedFriendsPage = z.output<typeof InvitedFriendsPageSchema>;

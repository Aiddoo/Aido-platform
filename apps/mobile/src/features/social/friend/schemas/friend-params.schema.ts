import { userIdParamSchema } from '@aido/api';
import { z } from 'zod';

export const friendScreenParamsSchema = z.object({
  friendId: userIdParamSchema.shape.userId,
});

export const FRIEND_LIST_VIEW = {
  friends: 'friends',
  receiver: 'receiver',
  sender: 'sender',
} as const;

export const friendListViewSchema = z.enum(FRIEND_LIST_VIEW);

export type FriendListView = z.output<typeof friendListViewSchema>;

/** 친구 화면의 탭(`?view=`)과 목록 편집 모드(`?isEditing=true`, 끄면 값이 없어진다) */
export const friendListParamsSchema = z.object({
  view: friendListViewSchema.catch(FRIEND_LIST_VIEW.friends),
  isEditing: z.stringbool().catch(false),
});

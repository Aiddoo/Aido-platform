import {
  friendRequestUserSchema as friendRequestUserContractSchema,
  friendsListResponseSchema,
  friendUserSchema as friendUserContractSchema,
  type ReorderFriendInput as ReorderFriendContractInput,
  receivedRequestsResponseSchema,
  reorderFriendResponseSchema,
  searchUsersResponseSchema,
  type searchUserSchema,
  sendFriendRequestResponseSchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const friendUserSchema = friendUserContractSchema.extend({ friendsSince: instantSchema });
export type FriendUser = z.infer<typeof friendUserSchema>;

const friendRequestSchema = friendRequestUserContractSchema.extend({
  requestedAt: instantSchema,
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

export type SearchedUser = z.infer<typeof searchUserSchema>;

export const friendsPageSchema = friendsListResponseSchema.extend({
  friends: z.array(friendUserSchema),
});

/** 받은 요청과 보낸 요청은 응답 모양이 같다 */
export const friendRequestsPageSchema = receivedRequestsResponseSchema.extend({
  requests: z.array(friendRequestSchema),
});

export const searchedUsersPageSchema = searchUsersResponseSchema;

export type FriendsPageDto = z.output<typeof friendsPageSchema>;
export type FriendRequestsPageDto = z.output<typeof friendRequestsPageSchema>;
export type SearchedUsersPageDto = z.output<typeof searchedUsersPageSchema>;

export const sendRequestResultSchema = sendFriendRequestResponseSchema.pick({
  autoAccepted: true,
});
export type SendRequestResult = z.infer<typeof sendRequestResultSchema>;

export const reorderedFriendSchema = reorderFriendResponseSchema.extend({
  friend: friendUserSchema,
});

/** 친구·요청 목록 페이지 입력. 생략하면 서버 기본값(limit 20)을 쓴다 */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface SearchUsersParams extends PaginationParams {
  query: string;
}

export type ReorderFriendInput = ReorderFriendContractInput;

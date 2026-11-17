import {
  acceptFriendRequestResponseSchema,
  rejectFriendRequestResponseSchema,
  removeFriendResponseSchema,
  reorderFriendResponseSchema,
  sendFriendRequestResponseSchema,
  followIdParamSchema,
  friendsListResponseSchema,
  receivedRequestsResponseSchema,
  sentRequestsResponseSchema,
  getFollowsQuerySchema,
  getFriendsQuerySchema,
  reorderFriendSchema,
  searchUsersQuerySchema,
  searchUsersResponseSchema,
  userTagParamSchema,
} from "@aido/api";
import { ApiProperty } from "@nestjs/swagger";
import type { z } from "zod";

export const SendFriendRequestResponseDto = sendFriendRequestResponseSchema.meta({
  id: "SendFriendRequestResponseDto",
});
export type SendFriendRequestResponseDto = z.infer<typeof SendFriendRequestResponseDto>;
export const AcceptFriendRequestResponseDto = acceptFriendRequestResponseSchema.meta({
  id: "AcceptFriendRequestResponseDto",
});
export type AcceptFriendRequestResponseDto = z.infer<typeof AcceptFriendRequestResponseDto>;
export const RejectFriendRequestResponseDto = rejectFriendRequestResponseSchema.meta({
  id: "RejectFriendRequestResponseDto",
});
export type RejectFriendRequestResponseDto = z.infer<typeof RejectFriendRequestResponseDto>;
export const RemoveFriendResponseDto = removeFriendResponseSchema.meta({
  id: "RemoveFriendResponseDto",
});
export type RemoveFriendResponseDto = z.infer<typeof RemoveFriendResponseDto>;
export const ReorderFriendResponseDto = reorderFriendResponseSchema.meta({
  id: "ReorderFriendResponseDto",
});
export type ReorderFriendResponseDto = z.infer<typeof ReorderFriendResponseDto>;

export const FriendsListResponseDto = friendsListResponseSchema.meta({
  id: "FriendsListResponseDto",
});
export type FriendsListResponseDto = z.infer<typeof FriendsListResponseDto>;
export const ReceivedRequestsResponseDto = receivedRequestsResponseSchema.meta({
  id: "ReceivedRequestsResponseDto",
});
export type ReceivedRequestsResponseDto = z.infer<typeof ReceivedRequestsResponseDto>;
export const SentRequestsResponseDto = sentRequestsResponseSchema.meta({
  id: "SentRequestsResponseDto",
});
export type SentRequestsResponseDto = z.infer<typeof SentRequestsResponseDto>;

export class FollowResourceLimitResponseDto {
  @ApiProperty({ description: "현재 친구 수", example: 5 })
  declare friendCount: number;

  @ApiProperty({
    description: "최대 한도 (null이면 무제한)",
    example: 50,
    nullable: true,
    type: Number,
  })
  declare maxCount: number | null;
}

export const GetFollowsQueryDto = getFollowsQuerySchema.meta({
  id: "GetFollowsQueryDto",
  apiParameter: true,
});
export type GetFollowsQueryDto = z.infer<typeof GetFollowsQueryDto>;
export const GetFriendsQueryDto = getFriendsQuerySchema.meta({
  id: "GetFriendsQueryDto",
  apiParameter: true,
});
export type GetFriendsQueryDto = z.infer<typeof GetFriendsQueryDto>;

export const ReorderFriendDto = reorderFriendSchema.meta({ id: "ReorderFriendDto" });
export type ReorderFriendDto = z.infer<typeof ReorderFriendDto>;

export const SearchUsersQueryDto = searchUsersQuerySchema.meta({
  id: "SearchUsersQueryDto",
  apiParameter: true,
});
export type SearchUsersQueryDto = z.infer<typeof SearchUsersQueryDto>;

export const SearchUsersResponseDto = searchUsersResponseSchema.meta({
  id: "SearchUsersResponseDto",
});
export type SearchUsersResponseDto = z.infer<typeof SearchUsersResponseDto>;

export const UserTagParamDto = userTagParamSchema.meta({
  id: "UserTagParamDto",
  apiParameter: true,
});
export type UserTagParamDto = z.infer<typeof UserTagParamDto>;
export const FollowIdParamDto = followIdParamSchema.meta({
  id: "FollowIdParamDto",
  apiParameter: true,
});
export type FollowIdParamDto = z.infer<typeof FollowIdParamDto>;

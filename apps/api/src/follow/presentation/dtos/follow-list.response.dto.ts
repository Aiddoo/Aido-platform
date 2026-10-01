import {
	friendsListResponseSchema,
	receivedRequestsResponseSchema,
	sentRequestsResponseSchema,
} from "@aido/validators";
import type { z } from "zod";

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

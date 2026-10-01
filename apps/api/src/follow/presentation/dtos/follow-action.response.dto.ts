import {
	acceptFriendRequestResponseSchema,
	rejectFriendRequestResponseSchema,
	removeFriendResponseSchema,
	reorderFriendResponseSchema,
	sendFriendRequestResponseSchema,
} from "@aido/validators";
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

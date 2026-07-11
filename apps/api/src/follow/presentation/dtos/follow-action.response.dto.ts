import {
	acceptFriendRequestResponseSchema,
	rejectFriendRequestResponseSchema,
	removeFriendResponseSchema,
	reorderFriendResponseSchema,
	sendFriendRequestResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SendFriendRequestResponseDto extends createZodDto(
	sendFriendRequestResponseSchema,
) {}
export class AcceptFriendRequestResponseDto extends createZodDto(
	acceptFriendRequestResponseSchema,
) {}
export class RejectFriendRequestResponseDto extends createZodDto(
	rejectFriendRequestResponseSchema,
) {}
export class RemoveFriendResponseDto extends createZodDto(
	removeFriendResponseSchema,
) {}
export class ReorderFriendResponseDto extends createZodDto(
	reorderFriendResponseSchema,
) {}

import {
	type FriendRequestUser,
	type FriendUser,
	friendRequestUserSchema,
	friendUserSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class FriendUserResponseDto
	extends createZodDto(friendUserSchema)
	implements FriendUser {}
export class FriendRequestUserResponseDto
	extends createZodDto(friendRequestUserSchema)
	implements FriendRequestUser {}

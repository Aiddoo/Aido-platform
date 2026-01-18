/**
 * 친구 사용자 정보 응답 DTO
 */

import {
	type FriendRequestUser,
	type FriendUser,
	friendRequestUserSchema,
	friendUserSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/** 친구 목록에서 보여줄 사용자 정보 */
export class FriendUserResponseDto
	extends createZodDto(friendUserSchema)
	implements FriendUser {}

/** 친구 요청 목록에서 보여줄 사용자 정보 */
export class FriendRequestUserResponseDto
	extends createZodDto(friendRequestUserSchema)
	implements FriendRequestUser {}

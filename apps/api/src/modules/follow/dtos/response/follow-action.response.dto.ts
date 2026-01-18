/**
 * 친구 요청 액션 응답 DTO
 */

import {
	acceptFriendRequestResponseSchema,
	rejectFriendRequestResponseSchema,
	removeFriendResponseSchema,
	sendFriendRequestResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/** 친구 요청 보내기 성공 응답 */
export class SendFriendRequestResponseDto extends createZodDto(
	sendFriendRequestResponseSchema,
) {}

/** 친구 요청 수락 성공 응답 */
export class AcceptFriendRequestResponseDto extends createZodDto(
	acceptFriendRequestResponseSchema,
) {}

/** 친구 요청 거절 성공 응답 */
export class RejectFriendRequestResponseDto extends createZodDto(
	rejectFriendRequestResponseSchema,
) {}

/** 친구 삭제 성공 응답 */
export class RemoveFriendResponseDto extends createZodDto(
	removeFriendResponseSchema,
) {}

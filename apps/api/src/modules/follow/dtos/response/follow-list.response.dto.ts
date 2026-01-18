/**
 * 친구/요청 목록 응답 DTO
 */

import {
	friendsListResponseSchema,
	receivedRequestsResponseSchema,
	sentRequestsResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/** 친구 목록 응답 */
export class FriendsListResponseDto extends createZodDto(
	friendsListResponseSchema,
) {}

/** 받은 친구 요청 목록 응답 */
export class ReceivedRequestsResponseDto extends createZodDto(
	receivedRequestsResponseSchema,
) {}

/** 보낸 친구 요청 목록 응답 */
export class SentRequestsResponseDto extends createZodDto(
	sentRequestsResponseSchema,
) {}

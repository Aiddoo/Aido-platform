/**
 * 사용자 태그 파라미터 DTO
 */

import { sendFriendRequestParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UserTagParamDto extends createZodDto(
	sendFriendRequestParamSchema,
) {}

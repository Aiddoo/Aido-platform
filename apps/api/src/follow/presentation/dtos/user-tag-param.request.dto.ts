import { sendFriendRequestParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UserTagParamDto extends createZodDto(
	sendFriendRequestParamSchema,
) {}

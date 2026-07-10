import {
	friendsListResponseSchema,
	receivedRequestsResponseSchema,
	sentRequestsResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class FriendsListResponseDto extends createZodDto(
	friendsListResponseSchema,
) {}
export class ReceivedRequestsResponseDto extends createZodDto(
	receivedRequestsResponseSchema,
) {}
export class SentRequestsResponseDto extends createZodDto(
	sentRequestsResponseSchema,
) {}

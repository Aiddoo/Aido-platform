import { getFollowsQuerySchema, getFriendsQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetFollowsQueryDto extends createZodDto(getFollowsQuerySchema) {}
export class GetFriendsQueryDto extends createZodDto(getFriendsQuerySchema) {}

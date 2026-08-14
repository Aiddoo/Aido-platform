import { searchUsersResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SearchUsersResponseDto extends createZodDto(searchUsersResponseSchema) {}

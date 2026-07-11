import { searchUsersQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SearchUsersQueryDto extends createZodDto(searchUsersQuerySchema) {}

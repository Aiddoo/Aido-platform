import { userIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UserIdParamDto extends createZodDto(userIdParamSchema) {}

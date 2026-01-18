/**
 * 사용자 ID 파라미터 DTO
 */

import { userIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UserIdParamDto extends createZodDto(userIdParamSchema) {}

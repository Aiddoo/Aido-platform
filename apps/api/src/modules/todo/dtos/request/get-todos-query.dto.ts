/**
 * Todo 목록 조회 쿼리 DTO
 */

import { getTodosQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetTodosQueryDto extends createZodDto(getTodosQuerySchema) {}

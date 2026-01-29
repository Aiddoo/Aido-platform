import { reorderTodoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 할 일 순서 변경 요청 DTO
 */
export class ReorderTodoDto extends createZodDto(reorderTodoSchema) {}

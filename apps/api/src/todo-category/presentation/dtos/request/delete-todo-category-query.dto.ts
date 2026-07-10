import { deleteTodoCategoryQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class DeleteTodoCategoryQueryDto extends createZodDto(
	deleteTodoCategoryQuerySchema,
) {}

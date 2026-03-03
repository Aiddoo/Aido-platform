import { suggestionIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SuggestionIdParamDto extends createZodDto(
	suggestionIdParamSchema,
) {}

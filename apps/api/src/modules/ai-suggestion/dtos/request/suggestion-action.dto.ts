import { suggestionActionSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SuggestionActionDto extends createZodDto(suggestionActionSchema) {}

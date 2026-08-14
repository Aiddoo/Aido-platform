import { suggestionActionResponseSchema, suggestionListResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class SuggestionListResponseDto extends createZodDto(suggestionListResponseSchema) {}

export class SuggestionActionResponseDto extends createZodDto(suggestionActionResponseSchema) {}

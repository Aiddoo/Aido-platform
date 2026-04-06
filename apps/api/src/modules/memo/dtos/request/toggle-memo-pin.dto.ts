import { toggleMemoPinSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class ToggleMemoPinDto extends createZodDto(toggleMemoPinSchema) {}

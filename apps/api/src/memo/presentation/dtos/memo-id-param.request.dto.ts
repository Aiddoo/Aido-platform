import { memoIdParamSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class MemoIdParamDto extends createZodDto(memoIdParamSchema) {}

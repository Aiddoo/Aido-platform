import { getCheersQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetCheersQueryDto extends createZodDto(getCheersQuerySchema) {}

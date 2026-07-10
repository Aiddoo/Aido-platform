import { getForecastQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetForecastQueryDto extends createZodDto(getForecastQuerySchema) {}

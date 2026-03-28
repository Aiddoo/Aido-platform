import {
	locationResponseSchema,
	weatherForecastSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class WeatherForecastResponseDto extends createZodDto(
	weatherForecastSchema,
) {}

export class LocationResponseDto extends createZodDto(locationResponseSchema) {}

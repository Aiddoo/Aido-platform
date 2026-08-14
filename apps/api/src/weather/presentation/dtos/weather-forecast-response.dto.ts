import {
	locationResponseSchema,
	weatherConditionsSchema,
	weatherForecastSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class WeatherForecastResponseDto extends createZodDto(weatherForecastSchema) {}

export class WeatherConditionsResponseDto extends createZodDto(weatherConditionsSchema) {}

export class LocationResponseDto extends createZodDto(locationResponseSchema) {}

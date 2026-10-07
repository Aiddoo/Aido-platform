import {
  locationResponseSchema,
  weatherConditionsSchema,
  weatherForecastSchema,
} from "@aido/validators";
import type { z } from "zod";

export const WeatherForecastResponseDto = weatherForecastSchema.meta({
  id: "WeatherForecastResponseDto",
});
export type WeatherForecastResponseDto = z.infer<typeof WeatherForecastResponseDto>;

export const WeatherConditionsResponseDto = weatherConditionsSchema.meta({
  id: "WeatherConditionsResponseDto",
});
export type WeatherConditionsResponseDto = z.infer<typeof WeatherConditionsResponseDto>;

export const LocationResponseDto = locationResponseSchema.meta({ id: "LocationResponseDto" });
export type LocationResponseDto = z.infer<typeof LocationResponseDto>;

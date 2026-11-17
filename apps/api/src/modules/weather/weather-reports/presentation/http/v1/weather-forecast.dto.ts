import {
  getForecastQuerySchema,
  weatherConditionsSchema,
  weatherForecastSchema,
} from "@aido/api/contracts/weather";
import type { z } from "zod";

export const GetForecastQueryDto = getForecastQuerySchema.meta({
  id: "GetForecastQueryDto",
  apiParameter: true,
});
export type GetForecastQueryDto = z.infer<typeof GetForecastQueryDto>;

export const WeatherForecastResponseDto = weatherForecastSchema.meta({
  id: "WeatherForecastResponseDto",
});
export type WeatherForecastResponseDto = z.infer<typeof WeatherForecastResponseDto>;

export const WeatherConditionsResponseDto = weatherConditionsSchema.meta({
  id: "WeatherConditionsResponseDto",
});
export type WeatherConditionsResponseDto = z.infer<typeof WeatherConditionsResponseDto>;

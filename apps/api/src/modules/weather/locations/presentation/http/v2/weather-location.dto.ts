import { updateWeatherLocationSchema, weatherLocationSchema } from "@aido/api/contracts/weather";
import type { z } from "zod";

export const UpdateWeatherLocationDto = updateWeatherLocationSchema.meta({
  id: "UpdateWeatherLocationDto",
});
export type UpdateWeatherLocationDto = z.infer<typeof UpdateWeatherLocationDto>;

export const WeatherLocationResponseDto = weatherLocationSchema.meta({
  id: "WeatherLocationResponseDto",
});
export type WeatherLocationResponseDto = z.infer<typeof WeatherLocationResponseDto>;

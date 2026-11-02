import { weatherLocationSchema, weatherReportSchema } from "@aido/api";
import type { z } from "zod";

export const WeatherLocationResponseDto = weatherLocationSchema.meta({
  id: "WeatherLocationResponseDto",
});
export type WeatherLocationResponseDto = z.infer<typeof WeatherLocationResponseDto>;

export const WeatherReportResponseDto = weatherReportSchema.meta({
  id: "WeatherReportResponseDto",
});
export type WeatherReportResponseDto = z.infer<typeof WeatherReportResponseDto>;

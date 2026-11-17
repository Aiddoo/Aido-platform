import { weatherReportSchema } from "@aido/api/contracts/weather";
import type { z } from "zod";

export const WeatherReportResponseDto = weatherReportSchema.meta({
  id: "WeatherReportResponseDto",
});
export type WeatherReportResponseDto = z.infer<typeof WeatherReportResponseDto>;

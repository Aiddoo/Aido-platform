import { getForecastQuerySchema } from "@aido/api";
import type { z } from "zod";

export const GetForecastQueryDto = getForecastQuerySchema.meta({
  id: "GetForecastQueryDto",
  apiParameter: true,
});
export type GetForecastQueryDto = z.infer<typeof GetForecastQueryDto>;

import { getForecastQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const GetForecastQueryDto = getForecastQuerySchema.meta({
	id: "GetForecastQueryDto",
	apiParameter: true,
});
export type GetForecastQueryDto = z.infer<typeof GetForecastQueryDto>;

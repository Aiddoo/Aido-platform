import { updateWeatherLocationSchema } from "@aido/api";
import type { z } from "zod";

export const UpdateWeatherLocationDto = updateWeatherLocationSchema.meta({
  id: "UpdateWeatherLocationDto",
});
export type UpdateWeatherLocationDto = z.infer<typeof UpdateWeatherLocationDto>;

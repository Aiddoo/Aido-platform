import { updateLocationSchema } from "@aido/api";
import type { z } from "zod";

export const UpdateLocationDto = updateLocationSchema.meta({ id: "UpdateLocationDto" });
export type UpdateLocationDto = z.infer<typeof UpdateLocationDto>;

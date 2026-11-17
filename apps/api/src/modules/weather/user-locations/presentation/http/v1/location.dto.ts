import { locationResponseSchema, updateLocationSchema } from "@aido/api/contracts/weather";
import type { z } from "zod";

export const UpdateLocationDto = updateLocationSchema.meta({ id: "UpdateLocationDto" });
export type UpdateLocationDto = z.infer<typeof UpdateLocationDto>;

export const LocationResponseDto = locationResponseSchema.meta({ id: "LocationResponseDto" });
export type LocationResponseDto = z.infer<typeof LocationResponseDto>;

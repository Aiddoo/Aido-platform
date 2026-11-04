import { pushDeviceResponseSchema } from "@aido/api";
import type { z } from "zod";

export const PushDeviceResponseDto = pushDeviceResponseSchema.meta({ id: "PushDeviceResponseDto" });
export type PushDeviceResponseDto = z.infer<typeof PushDeviceResponseDto>;

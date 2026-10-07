import { cheerCooldownInfoSchema } from "@aido/api";
import type { z } from "zod";

export const CheerCooldownResponseDto = cheerCooldownInfoSchema.meta({
  id: "CheerCooldownResponseDto",
});
export type CheerCooldownResponseDto = z.infer<typeof CheerCooldownResponseDto>;

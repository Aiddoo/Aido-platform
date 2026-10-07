import { nudgeCooldownInfoSchema } from "@aido/validators";
import type { z } from "zod";

export const NudgeCooldownResponseDto = nudgeCooldownInfoSchema.meta({
  id: "NudgeCooldownResponseDto",
});
export type NudgeCooldownResponseDto = z.infer<typeof NudgeCooldownResponseDto>;

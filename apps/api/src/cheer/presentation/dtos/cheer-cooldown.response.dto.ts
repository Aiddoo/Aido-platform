import { cheerCooldownInfoSchema } from "@aido/validators";
import type { z } from "zod";

export const CheerCooldownResponseDto = cheerCooldownInfoSchema.meta({
	id: "CheerCooldownResponseDto",
});
export type CheerCooldownResponseDto = z.infer<typeof CheerCooldownResponseDto>;

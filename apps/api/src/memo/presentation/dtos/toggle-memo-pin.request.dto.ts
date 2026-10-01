import { toggleMemoPinSchema } from "@aido/validators";
import type { z } from "zod";

export const ToggleMemoPinDto = toggleMemoPinSchema.meta({ id: "ToggleMemoPinDto" });
export type ToggleMemoPinDto = z.infer<typeof ToggleMemoPinDto>;

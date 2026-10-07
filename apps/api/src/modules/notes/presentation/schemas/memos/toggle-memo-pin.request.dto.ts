import { toggleMemoPinSchema } from "@aido/api";
import type { z } from "zod";

export const ToggleMemoPinDto = toggleMemoPinSchema.meta({ id: "ToggleMemoPinDto" });
export type ToggleMemoPinDto = z.infer<typeof ToggleMemoPinDto>;

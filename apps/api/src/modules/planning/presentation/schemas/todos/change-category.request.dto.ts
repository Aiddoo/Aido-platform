import { changeTodoCategorySchema } from "@aido/api";
import type { z } from "zod";

export const ChangeTodoCategoryDto = changeTodoCategorySchema.meta({ id: "ChangeTodoCategoryDto" });
export type ChangeTodoCategoryDto = z.infer<typeof ChangeTodoCategoryDto>;

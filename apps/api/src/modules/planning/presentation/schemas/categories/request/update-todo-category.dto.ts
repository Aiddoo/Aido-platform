import { updateTodoCategorySchema } from "@aido/api";
import type { z } from "zod";

export const UpdateTodoCategoryDto = updateTodoCategorySchema.meta({ id: "UpdateTodoCategoryDto" });
export type UpdateTodoCategoryDto = z.infer<typeof UpdateTodoCategoryDto>;

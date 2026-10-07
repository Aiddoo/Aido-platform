import { reorderTodoCategorySchema } from "@aido/validators";
import type { z } from "zod";

export const ReorderTodoCategoryDto = reorderTodoCategorySchema.meta({
  id: "ReorderTodoCategoryDto",
});
export type ReorderTodoCategoryDto = z.infer<typeof ReorderTodoCategoryDto>;

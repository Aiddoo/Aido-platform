import { deleteTodoCategoryQuerySchema } from "@aido/api";
import type { z } from "zod";

export const DeleteTodoCategoryQueryDto = deleteTodoCategoryQuerySchema.meta({
  id: "DeleteTodoCategoryQueryDto",
  apiParameter: true,
});
export type DeleteTodoCategoryQueryDto = z.infer<typeof DeleteTodoCategoryQueryDto>;

import { getTodoSummaryQuerySchema } from "@aido/api";
import type { z } from "zod";

export const TodoSummaryQueryDto = getTodoSummaryQuerySchema.meta({
  id: "TodoSummaryQueryDto",
  apiParameter: true,
});
export type TodoSummaryQueryDto = z.infer<typeof TodoSummaryQueryDto>;

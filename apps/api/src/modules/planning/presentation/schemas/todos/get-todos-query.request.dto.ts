import { getTodosQuerySchema } from "@aido/api";
import type { z } from "zod";

export const GetTodosQueryDto = getTodosQuerySchema.meta({
  id: "GetTodosQueryDto",
  apiParameter: true,
});
export type GetTodosQueryDto = z.infer<typeof GetTodosQueryDto>;
